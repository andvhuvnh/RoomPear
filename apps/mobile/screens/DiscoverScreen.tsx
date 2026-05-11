import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { DotsThreeVertical, ArrowCounterClockwise, X, Heart } from 'phosphor-react-native';
import { fonts } from '../lib/typography';
import { supabase } from '../lib/supabase';
import { recordSwipe } from '../lib/discover';
import { getProfileImageUrls } from '../lib/storage';
import { profilePhotoPathsFromRow } from '../lib/profileDisplay';
import { getDiscoverUsage } from '../lib/dailyDiscoverUsage';
import { FREE_TIER_LIMITS, PREMIUM_TIER_LIMITS } from '../lib/freeTierLimits';
import { usePurchases } from '../context/PurchasesContext';
import { useDiscoverDeck } from '../context/DiscoverDeckContext';
import SwipeCard from '../components/SwipeCard';
import DiscoverFiltersModal from '../components/DiscoverFiltersModal';
import BlockReportModal from '../components/BlockReportModal';
import type { MainTabParamList } from '../navigation/MainTabNavigator';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const C = {
  bg:            '#C8E6C9',
  text:          '#1A2C24',
  white:         '#FFFFFF',
  gray:          '#717182',
  grayDim:       '#A0A0B0',
  surface:       'rgba(255,255,255,0.88)',
  surfaceBorder: 'rgba(255,255,255,0.50)',
  cta:           '#030213',
  pass:          '#D4183D',
  like:          '#2D6A4F',
};

const GRAD = ['#C8EAC0','#D4EEB8','#E2F0C8','#EEF6E0','#F6FAF0','#FFFFFF'] as const;
const LOCS = [0, 0.18, 0.40, 0.62, 0.82, 1] as const;


type Action = 'like' | 'pass' | 'top_pick';

type MatchData = {
  name: string;
  otherUserId: string;
  theirPhotoUrl: string | null;
  myPhotoUrl: string | null;
  sharedInterests: string[];
};

function Background({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient
        colors={GRAD}
        locations={LOCS}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient pear-colored blobs — matches onboarding palette */}
      <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#E8B84B', opacity: 0.13, top: -60, right: -60 }} pointerEvents="none" />
      <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#D4A028', opacity: 0.10, bottom: 120, left: -60 }} pointerEvents="none" />
      <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#4A9060', opacity: 0.09, bottom: 320, right: 10 }} pointerEvents="none" />
      {children}
    </View>
  );
}

export default function DiscoverScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { presentPaywall } = usePurchases();
  const {
    userId,
    profiles,
    currentIndex,
    setCurrentIndex,
    deckInitialLoading,
    hasPremiumAccess,
    refreshDeck,
    removeProfileFromDeck,
  } = useDiscoverDeck();
  const [myPhotoUrl, setMyPhotoUrl] = useState<string | null>(null);
  const [myHobbies, setMyHobbies] = useState<string[]>([]);
  const [hasActiveRadiusFilter, setHasActiveRadiusFilter] = useState(false);
  const [actionDisabled, setActionDisabled] = useState(false);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [dailyUsage, setDailyUsage] = useState({ swipes: 0, topPicks: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const logoBobAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoBobAnim, { toValue: -8, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(logoBobAnim, { toValue: 0,  duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [logoBobAnim]);

  const refreshDailyUsage = useCallback(async (uid: string) => {
    const u = await getDiscoverUsage(uid);
    setDailyUsage(u);
  }, []);
  const openPaywallIfNeeded = useCallback(async () => {
    if (hasPremiumAccess) return;
    await presentPaywall();
  }, [hasPremiumAccess, presentPaywall]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: me } = await supabase
        .from('profiles')
        .select('profile_photo_url, hobbies, is_paused')
        .eq('id', userId)
        .single();
      if (cancelled) return;
      setIsPaused(me?.is_paused === true);
      if (me?.profile_photo_url) {
        const paths = profilePhotoPathsFromRow(me.profile_photo_url);
        if (paths[0]) {
          const urls = await getProfileImageUrls(me.profile_photo_url);
          if (!cancelled) setMyPhotoUrl(urls?.[0] ?? null);
        } else {
          setMyPhotoUrl(null);
        }
      } else {
        setMyPhotoUrl(null);
      }
      const { data: myPrefs } = await supabase
        .from('preferences')
        .select('interests, search_lat, search_lng, search_radius_miles')
        .eq('user_id', userId)
        .single();
      if (cancelled) return;
      const radiusMiles = myPrefs?.search_radius_miles;
      const radiusEnabled =
        myPrefs?.search_lat != null &&
        myPrefs?.search_lng != null &&
        Number.isFinite(radiusMiles) &&
        radiusMiles > 0;
      setHasActiveRadiusFilter(radiusEnabled);
      const interestChips = Object.values(myPrefs?.interests ?? {}).flat() as string[];
      setMyHobbies(
        interestChips.length > 0 ? interestChips : (Array.isArray(me?.hobbies) ? me.hobbies : [])
      );
      await refreshDailyUsage(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshDailyUsage]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      refreshDailyUsage(userId);
      supabase
        .from('profiles')
        .select('is_paused')
        .eq('id', userId)
        .single()
        .then(({ data }) => setIsPaused(data?.is_paused === true));
    }, [userId, refreshDailyUsage])
  );

  const reloadDiscoverVisual = useCallback(async (opts?: { silent?: boolean }) => {
    translateX.setValue(0);
    translateY.setValue(0);
    cardOpacity.setValue(1);
    await refreshDeck(opts);
  }, [refreshDeck, translateX, translateY, cardOpacity]);

  function animateOut(direction: Action, onFlyAwayComplete: () => void) {
    const toX =
      direction === 'like' ? SCREEN_WIDTH * 1.5
      : direction === 'pass' ? -SCREEN_WIDTH * 1.5
      : 0;
    const toY = direction === 'top_pick' ? -SCREEN_HEIGHT : 0;
    Animated.parallel([
      Animated.timing(translateX, { toValue: toX, duration: 280, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: toY, duration: 280, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      translateX.setValue(0);
      translateY.setValue(0);
      // Keep opacity at 0 until the next profile is committed + faded in (avoids flashing the old card while recordSwipe runs).
      onFlyAwayComplete();
    });
  }

  async function handleAction(direction: Action) {
    if (actionDisabled) return;
    if (!userId) return;

    const usage = await getDiscoverUsage(userId);
    if (direction === 'top_pick') {
      const topPickLimit = hasPremiumAccess
        ? PREMIUM_TIER_LIMITS.topPicksPerDay
        : FREE_TIER_LIMITS.topPicksPerDay;
      if (usage.topPicks >= topPickLimit) {
        await openPaywallIfNeeded();
        return;
      }
    }
    if (!hasPremiumAccess && usage.swipes >= FREE_TIER_LIMITS.swipesPerDay) {
      await openPaywallIfNeeded();
      return;
    }

    setActionDisabled(true);
    const current = profiles[currentIndex];
    animateOut(direction, () => {
      setCurrentIndex(prev => prev + 1);
      Animated.timing(cardOpacity, { toValue: 1, duration: 160, useNativeDriver: true }).start(() => {
        setActionDisabled(false);
      });

      void (async () => {
        if (!current || !userId) {
          await refreshDailyUsage(userId);
          return;
        }
        try {
          const { isMatch } = await recordSwipe(userId, current.id, direction);
          if (isMatch) {
            const sharedInterests = myHobbies.filter(h => (current.hobbies ?? []).includes(h));
            setMatchData({
              name: current.name,
              otherUserId: current.id,
              theirPhotoUrl: current.photoUrls?.[0] ?? null,
              myPhotoUrl,
              sharedInterests,
            });
          }
        } finally {
          await refreshDailyUsage(userId);
        }
      })();
    });
  }

  async function handleUndo() {
    if (actionDisabled || currentIndex === 0) return;
    setActionDisabled(true);
    cardOpacity.setValue(0);
    setCurrentIndex(prev => prev - 1);
    Animated.timing(cardOpacity, { toValue: 1, duration: 220, useNativeDriver: true })
      .start(() => setActionDisabled(false));
  }

  const currentProfile = profiles[currentIndex];
  const nextProfile = profiles[currentIndex + 1];
  const remaining = profiles.length - currentIndex;

  useEffect(() => {
    if (!nextProfile) return;
    const count = nextProfile.profilePhotoCount || nextProfile.photoUrls.length;
    const urls = nextProfile.photoUrls.slice(0, Math.min(4, Math.max(0, count)));
    if (urls.length === 0) return;
    void ExpoImage.prefetch(urls, 'memory-disk');
  }, [nextProfile?.id]);

  if (deckInitialLoading) {
    return (
      <Background>
        <View style={styles.centered}>
          <Animated.View style={{ transform: [{ translateY: logoBobAnim }] }}>
            <Image
              source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')}
              style={{ width: 72, height: 72 }}
              resizeMode="contain"
            />
          </Animated.View>
        </View>
      </Background>
    );
  }

  if (isPaused) {
    return (
      <Background>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Your profile is paused</Text>
          <Text style={styles.emptyText}>
            {"You're hidden from discover.\nUnpause to start swiping again."}
          </Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={async () => {
              if (!userId) return;
              const { error } = await supabase
                .from('profiles')
                .update({ is_paused: false })
                .eq('id', userId);
              if (!error) setIsPaused(false);
            }}
          >
            <Text style={styles.refreshBtnText}>Unpause my profile</Text>
          </TouchableOpacity>
        </View>
      </Background>
    );
  }

  if (!currentProfile) {
    const noNearbyUsers = profiles.length === 0 && hasActiveRadiusFilter;

    return (
      <Background>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>
            {noNearbyUsers ? 'No nearby roommates yet' : "You're all caught up"}
          </Text>
          <Text style={styles.emptyText}>
            {noNearbyUsers
              ? 'Try adjusting your preferences, then refresh Discover.'
              : `No more profiles right now.\nCheck back later!`}
          </Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => void reloadDiscoverVisual()}
          >
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setFiltersOpen(true)}
          >
            <Text style={styles.secondaryBtnText}>
              {noNearbyUsers ? 'Adjust Preferences' : 'Adjust Preferences'}
            </Text>
          </TouchableOpacity>
        </View>
        {userId ? (
          <DiscoverFiltersModal
            visible={filtersOpen}
            userId={userId}
            onClose={() => setFiltersOpen(false)}
            onApply={() => void reloadDiscoverVisual({ silent: true })}
            isPremium={hasPremiumAccess}
            onUpgrade={openPaywallIfNeeded}
          />
        ) : null}
      </Background>
    );
  }

  return (
    <Background>
      <SafeAreaView style={styles.root} edges={['top']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image
              source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')}
              style={styles.pearLogo}
              resizeMode="contain"
            />
            {hasPremiumAccess ? (
              <Text style={styles.headerMetricsPremium}>
                RoomPear+ · Unlimited swipes, advanced filters, and boosted profile
              </Text>
            ) : (
              <Text style={styles.headerMetrics}>
                {Math.max(0, FREE_TIER_LIMITS.swipesPerDay - dailyUsage.swipes)}/
                {FREE_TIER_LIMITS.swipesPerDay} swipes today ·{' '}
                {dailyUsage.topPicks >= FREE_TIER_LIMITS.topPicksPerDay ? 'Top Pick used' : 'Top Pick ready'}
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.nearbyPill}>{remaining} nearby</Text>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setFiltersOpen(true)}>
              <DotsThreeVertical size={20} color={C.text} weight="bold" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Card stack ── */}
        <View style={styles.cardArea}>

          {/* Back card */}
          {nextProfile && (
            <View style={styles.backCardWrap} pointerEvents="none">
              <SwipeCard key={`deck-back-${nextProfile.id}`} profile={nextProfile} />
            </View>
          )}

          {/* Front card */}
          <Animated.View
            style={[
              styles.frontCardWrap,
              { transform: [{ translateX }, { translateY }], opacity: cardOpacity },
            ]}
          >
            <SwipeCard
              key={`deck-front-${currentProfile.id}`}
              profile={currentProfile}
              onReport={() => setReportTarget({ id: currentProfile.id, name: currentProfile.name })}
              showMatchReasons={hasPremiumAccess}
              onUnlockReasons={hasPremiumAccess ? undefined : openPaywallIfNeeded}
            />
          </Animated.View>
        </View>

        {/* ── Action bar ── */}
        <View style={[styles.actionBar, actionDisabled && styles.actionBarDisabled]}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionUndo, (currentIndex === 0 || actionDisabled) && styles.actionLocked]}
            onPress={handleUndo}
            disabled={currentIndex === 0 || actionDisabled}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowCounterClockwise size={18} color="#A0A0B0" weight="bold" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionPass]}
            onPress={() => handleAction('pass')}
            disabled={actionDisabled}
          >
            <X size={24} color="#E5334B" weight="regular" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionLike]}
            onPress={() => handleAction('like')}
            disabled={actionDisabled}
          >
            <Heart size={28} color="#2D6A4F" weight="regular" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionTop]}
            onPress={() => handleAction('top_pick')}
            disabled={actionDisabled}
          >
            <Image source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')} style={{ width: 26, height: 26 }} resizeMode="contain" />
          </TouchableOpacity>
        </View>

      </SafeAreaView>

      {/* ── Filters modal ── */}
      {userId ? (
        <DiscoverFiltersModal
          visible={filtersOpen}
          userId={userId}
          onClose={() => setFiltersOpen(false)}
          onApply={() => void reloadDiscoverVisual({ silent: true })}
          isPremium={hasPremiumAccess}
          onUpgrade={openPaywallIfNeeded}
        />
      ) : null}

      {/* ── Match modal ── */}
      <Modal visible={!!matchData} transparent animationType="fade">
        <View style={styles.matchOverlay}>
          <View style={styles.matchCard}>
            <Text style={styles.matchEmoji}>🍐</Text>
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <View style={styles.matchAvatars}>
              <View style={styles.matchAvatarWrap}>
                {matchData?.myPhotoUrl
                  ? <Image source={{ uri: matchData.myPhotoUrl }} style={styles.matchAvatar} />
                  : <View style={[styles.matchAvatar, styles.matchAvatarPlaceholder]} />}
              </View>
              <View style={[styles.matchAvatarWrap, styles.matchAvatarRight]}>
                {matchData?.theirPhotoUrl
                  ? <Image source={{ uri: matchData.theirPhotoUrl }} style={styles.matchAvatar} />
                  : <View style={[styles.matchAvatar, styles.matchAvatarPlaceholder]} />}
              </View>
            </View>
            <Text style={styles.matchSub}>
              You and {matchData?.name} both want to be roommates!
            </Text>
            {matchData && matchData.sharedInterests.length > 0 && (
              <View style={styles.matchInterestsWrap}>
                <Text style={styles.matchInterestsLabel}>You both like</Text>
                <View style={styles.matchChips}>
                  {matchData.sharedInterests.slice(0, 3).map(interest => (
                    <View key={interest} style={styles.matchChip}>
                      <Text style={styles.matchChipText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <TouchableOpacity
              style={styles.matchBtn}
              onPress={() => {
                setMatchData(null);
                navigation.navigate('Chats', {
                  screen: 'Chat',
                  params: { otherUserId: matchData!.otherUserId, title: matchData!.name },
                } as any);
              }}
            >
              <Text style={styles.matchBtnText}>Send Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.matchBtnSecondary} onPress={() => setMatchData(null)}>
              <Text style={styles.matchBtnSecondaryText}>Keep Swiping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {reportTarget && userId && (
        <BlockReportModal
          visible={!!reportTarget}
          reporterId={userId}
          reportedId={reportTarget.id}
          reportedName={reportTarget.name}
          onClose={() => setReportTarget(null)}
          onBlocked={() => {
            const id = reportTarget?.id;
            setReportTarget(null);
            if (id) removeProfileFromDeck(id);
          }}
        />
      )}
    </Background>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  emptyTitle: { fontFamily: fonts.extraBold, fontSize: 22, color: C.text, marginBottom: 8 },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, color: C.gray, textAlign: 'center', lineHeight: 22 },
  refreshBtn: {
    marginTop: 24, backgroundColor: '#000000',
    paddingHorizontal: 28, paddingVertical: 13, borderRadius: 50,
  },
  refreshBtnText: { fontFamily: fonts.bold, color: C.white, fontSize: 15 },
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.70)',
  },
  secondaryBtnText: { fontFamily: fonts.semiBold, color: C.text, fontSize: 14 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pearLogo: { width: 36, height: 36 },
  headerMetrics: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: 'rgba(26,44,36,0.65)',
    lineHeight: 16,
  },
  headerMetricsPremium: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#1A2C24',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nearbyPill: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: '#1A2C24',
    backgroundColor: 'rgba(255,255,255,0.60)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.80)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.60)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.80)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Card area ──
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  backCardWrap: {
    position: 'absolute',
    top: 16,
    transform: [{ scale: 0.94 }, { translateY: 14 }, { rotate: '1.5deg' }],
    opacity: 0.6,
  },
  frontCardWrap: {
    position: 'absolute',
    top: 16,
  },

  // ── Action bar ──
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  actionBarDisabled: { opacity: 0.4 },
  actionBtn: {
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8EC',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  actionUndo:   { width: 44, height: 44 },
  actionPass:   { width: 58, height: 58 },
  actionLike:   { width: 68, height: 68 },
  actionTop:    { width: 58, height: 58 },
  actionLocked: { opacity: 0.35 },

  // ── Match modal ──
  matchOverlay: {
    flex: 1, backgroundColor: 'rgba(10,40,24,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  matchCard: {
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 28,
    paddingHorizontal: 28, paddingVertical: 32,
    alignItems: 'center', width: '86%',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#0A2818', shadowOpacity: 0.18, shadowRadius: 28, elevation: 14,
  },
  matchEmoji: { fontSize: 48, marginBottom: 6 },
  matchTitle: { fontFamily: fonts.extraBold, fontSize: 28, color: C.text, marginBottom: 16 },
  matchSub: {
    fontFamily: fonts.regular, fontSize: 15, color: C.gray, textAlign: 'center',
    lineHeight: 22, marginBottom: 16,
  },
  matchAvatars: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
  matchAvatarWrap: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
    overflow: 'hidden',
  },
  matchAvatarRight: { marginLeft: -20 },
  matchAvatar: { width: '100%', height: '100%', borderRadius: 45 },
  matchAvatarPlaceholder: { backgroundColor: '#D4E8D0' },
  matchInterestsWrap: { alignItems: 'center', marginBottom: 20 },
  matchInterestsLabel: {
    fontFamily: fonts.bold, fontSize: 11, color: C.grayDim,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  matchChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  matchChip: {
    backgroundColor: 'rgba(45,106,79,0.10)',
    borderWidth: 1.5, borderColor: 'rgba(45,106,79,0.30)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 50,
  },
  matchChipText: { fontFamily: fonts.semiBold, fontSize: 13, color: '#2D6A4F' },
  matchBtn: {
    backgroundColor: '#2D6A4F', paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 50, width: '100%', alignItems: 'center', marginBottom: 10,
  },
  matchBtnText: { fontFamily: fonts.bold, color: C.white, fontSize: 16 },
  matchBtnSecondary: {
    paddingVertical: 10, paddingHorizontal: 28, width: '100%', alignItems: 'center',
    backgroundColor: 'rgba(26,44,36,0.07)', borderRadius: 50,
  },
  matchBtnSecondaryText: { fontFamily: fonts.semiBold, color: C.text, fontSize: 15 },

});
