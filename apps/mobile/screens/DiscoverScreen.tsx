import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { DotsThreeVertical } from 'phosphor-react-native';
import { supabase } from '../lib/supabase';
import { fetchDiscoverProfiles, recordSwipe, type DiscoverProfile } from '../lib/discover';
import { getProfileImageUrls } from '../lib/storage';
import { profilePhotoPathsFromRow } from '../lib/profileDisplay';
import { getDiscoverUsage, recordDiscoverAction } from '../lib/dailyDiscoverUsage';
import { FREE_TIER_LIMITS, PREMIUM_TIER_LIMITS } from '../lib/freeTierLimits';
import { usePurchases } from '../context/PurchasesContext';
import { hasRoomPearPlusEntitlement, isPremiumProfileTier } from '../lib/purchasesConfig';
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
  top:           '#FF9500',
};

const GRAD = ['#C8E6C9','#DCEDC8','#E8F5E9','#F1F8F2','#F8FBF8','#FFFFFF'] as const;
const LOCS = [0, 0.18, 0.40, 0.62, 0.82, 1] as const;

// How far the buttons float up over the card's bottom edge
const BTN_OVERLAP = 52;

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
      <BlurView
        intensity={Platform.OS === 'ios' ? 52 : 34}
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : 'light'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

export default function DiscoverScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { isRoomPearPlus, customerInfo, presentPaywall } = usePurchases();
  const [hasPremiumTier, setHasPremiumTier] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState<string | null>(null);
  const [myHobbies, setMyHobbies] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [hasActiveRadiusFilter, setHasActiveRadiusFilter] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actionDisabled, setActionDisabled] = useState(false);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyUsage, setDailyUsage] = useState({ swipes: 0, topPicks: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const hasPremiumAccess = hasRoomPearPlusEntitlement(customerInfo) || isRoomPearPlus || hasPremiumTier;

  const refreshDailyUsage = useCallback(async (uid: string) => {
    const u = await getDiscoverUsage(uid);
    setDailyUsage(u);
  }, []);
  const openPaywallIfNeeded = useCallback(async () => {
    if (hasPremiumAccess) return;
    await presentPaywall();
  }, [hasPremiumAccess, presentPaywall]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: tierRow } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', uid)
          .maybeSingle();
        const isPremiumTier = isPremiumProfileTier(tierRow?.subscription_tier as string | undefined);
        setHasPremiumTier(isPremiumTier);
        const hasPremiumAtLoad = hasRoomPearPlusEntitlement(customerInfo) || isRoomPearPlus || isPremiumTier;
        loadProfiles(uid, hasPremiumAtLoad);
        const { data: me } = await supabase
          .from('profiles')
          .select('profile_photo_url, hobbies, is_paused')
          .eq('id', uid)
          .single();
        setIsPaused(me?.is_paused === true);
        if (me?.profile_photo_url) {
          const paths = profilePhotoPathsFromRow(me.profile_photo_url);
          if (paths[0]) {
            const urls = await getProfileImageUrls(me.profile_photo_url);
            setMyPhotoUrl(urls?.[0] ?? null);
          }
        }
        const { data: myPrefs } = await supabase
          .from('preferences')
          .select('interests, search_lat, search_lng, search_radius_miles')
          .eq('user_id', uid)
          .single();
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
        refreshDailyUsage(uid);
      } else {
        setHasPremiumTier(false);
      }
    });
  }, [isRoomPearPlus, customerInfo, refreshDailyUsage]);

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

  async function loadProfiles(uid: string, hasPremiumAccess = false) {
    setLoading(true);
    const data = await fetchDiscoverProfiles(uid, 10, { useAdvancedFilters: hasPremiumAccess, isPremium: hasPremiumAccess });
    setProfiles(data);
    setCurrentIndex(0);
    translateX.setValue(0);
    translateY.setValue(0);
    cardOpacity.setValue(1);
    setLoading(false);
  }

  function animateOut(direction: Action, onDone: () => void) {
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
      cardOpacity.setValue(1);
      onDone();
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
    animateOut(direction, async () => {
      if (current && userId) {
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
        await recordDiscoverAction(userId, direction);
        await refreshDailyUsage(userId);
      }
      setCurrentIndex(prev => prev + 1);
      setActionDisabled(false);
    });
  }

  async function handleUndo() {
    if (actionDisabled || currentIndex === 0) return;
    if (!hasPremiumAccess) {
      await openPaywallIfNeeded();
      return;
    }
    setActionDisabled(true);
    cardOpacity.setValue(0);
    setCurrentIndex(prev => prev - 1);
    Animated.timing(cardOpacity, { toValue: 1, duration: 220, useNativeDriver: true })
      .start(() => setActionDisabled(false));
  }

  const currentProfile = profiles[currentIndex];
  const nextProfile = profiles[currentIndex + 1];
  const remaining = profiles.length - currentIndex;


  if (loading) {
    return (
      <Background>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Finding roommates…</Text>
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
              ? 'Try increasing your search radius, then refresh Discover.'
              : `No more profiles right now.\nCheck back later!`}
          </Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => userId && loadProfiles(userId, hasPremiumAccess)}
          >
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </Background>
    );
  }

  return (
    <Background>
      <SafeAreaView style={styles.root} edges={['top']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.pearLogo}>🍐</Text>
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
              <SwipeCard profile={nextProfile} />
            </View>
          )}

          {/* Front card — actions integrated inside */}
          <Animated.View
            style={[
              styles.frontCardWrap,
              { transform: [{ translateX }, { translateY }], opacity: cardOpacity },
            ]}
          >
            <SwipeCard
              profile={currentProfile}
              onPass={() => handleAction('pass')}
              onLike={() => handleAction('like')}
              onTopPick={() => handleAction('top_pick')}
              onUndo={handleUndo}
              canUndo={currentIndex > 0}
              actionDisabled={actionDisabled}
              onReport={() => setReportTarget({ id: currentProfile.id, name: currentProfile.name })}
              showMatchReasons={hasPremiumAccess}
              onUnlockReasons={hasPremiumAccess ? undefined : openPaywallIfNeeded}
            />
          </Animated.View>
        </View>

      </SafeAreaView>

      {/* ── Filters modal ── */}
      {userId ? (
        <DiscoverFiltersModal
          visible={filtersOpen}
          userId={userId}
          onClose={() => setFiltersOpen(false)}
          onApply={() => userId && loadProfiles(userId)}
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
            setReportTarget(null);
            setCurrentIndex(i => i + 1);
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
  emptyTitle: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 8 },
  emptyText: { fontSize: 15, color: C.gray, textAlign: 'center', lineHeight: 22 },
  refreshBtn: {
    marginTop: 24, backgroundColor: C.cta,
    paddingHorizontal: 28, paddingVertical: 13, borderRadius: 50,
  },
  refreshBtnText: { color: C.white, fontWeight: '700', fontSize: 15 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  pearLogo: { fontSize: 32 },
  headerMetrics: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(26,44,36,0.65)',
    fontWeight: '600',
    lineHeight: 16,
  },
  headerMetricsPremium: {
    marginTop: 4,
    fontSize: 12,
    color: '#1A2C24',
    fontWeight: '700',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nearbyPill: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A2C24',
    backgroundColor: 'rgba(26,44,36,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(26,44,36,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Card area ──
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backCardWrap: {
    position: 'absolute',
    transform: [{ scale: 0.94 }, { translateY: 14 }, { rotate: '1.5deg' }],
    opacity: 0.6,
  },
  frontCardWrap: {
    position: 'absolute',
    // Cards sit BTN_OVERLAP px above center so buttons float on the bottom edge
    transform: [{ translateY: -(BTN_OVERLAP / 2) }],
  },

  // ── Floating action buttons ──
  floatingActions: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  btn: {
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
  },
  btnDisabled: { opacity: 0.3 },
  btnUndoLocked: { opacity: 0.55 },
  btnUndo: { width: 48, height: 48 },
  btnPass: { width: 62, height: 62, borderColor: 'rgba(212,24,61,0.30)' },
  btnTop:  { width: 62, height: 62, borderColor: 'rgba(255,149,0,0.30)' },
  btnLike: { width: 70, height: 70, borderColor: 'rgba(45,106,79,0.30)' },

  // ── Full profile modal ──
  profileModal: { flex: 1, backgroundColor: '#FFFFFF' },
  heroWrap: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.62, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    position: 'absolute', left: 20, right: 20, bottom: 24,
  },
  heroName: {
    fontSize: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  heroLocation: { fontSize: 15, color: 'rgba(255,255,255,0.88)', fontWeight: '500', marginTop: 4 },
  heroBudget: { fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: '500', marginTop: 3 },
  profileInfoBlock: { paddingHorizontal: 20, paddingVertical: 16 },
  stackedPhoto: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.55 },
  profileInfo: { padding: 24, paddingBottom: 16 },
  profileName: { fontSize: 28, fontWeight: '800', color: C.text },
  profileLocation: { fontSize: 15, color: C.gray, fontWeight: '500', marginTop: 4 },
  profileBio: { fontSize: 15, color: C.gray, lineHeight: 22 },
  profileSectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.grayDim,
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1,
  },
  profileChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  profileChip: {
    borderWidth: 1.5, borderColor: 'rgba(45,106,79,0.40)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 50,
  },
  profileChipText: { fontSize: 13, fontWeight: '600', color: '#2D6A4F' },
  interestCategory: { marginBottom: 10 },
  placePhotoLabel: {
    position: 'absolute',
    top: 18,
    left: 20,
  },
  placePhotoLabelText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  interestCategoryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A0A0B0',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  promptCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(45,106,79,0.05)',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  promptAccent: {
    width: 3,
    backgroundColor: '#2D6A4F',
  },
  promptContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  promptQuestion: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A0A0B0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  promptAnswer: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 20, paddingVertical: 20, paddingBottom: 36,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.08)',
  },
  closeBtn: {
    position: 'absolute', top: 52, right: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Match modal ──
  matchOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  matchCard: {
    backgroundColor: '#FFFFFF', borderRadius: 28,
    paddingHorizontal: 28, paddingVertical: 32,
    alignItems: 'center', width: '86%',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, elevation: 12,
  },
  matchEmoji: { fontSize: 48, marginBottom: 6 },
  matchTitle: { fontSize: 28, fontWeight: '900', color: C.text, marginBottom: 16 },
  matchSub: {
    fontSize: 15, color: C.gray, textAlign: 'center',
    lineHeight: 22, marginBottom: 16,
  },
  matchAvatars: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
  matchAvatarWrap: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
    overflow: 'hidden',
  },
  matchAvatarRight: { marginLeft: -20 },
  matchAvatar: { width: '100%', height: '100%', borderRadius: 45 },
  matchAvatarPlaceholder: { backgroundColor: '#E0E0E0' },
  matchInterestsWrap: { alignItems: 'center', marginBottom: 20 },
  matchInterestsLabel: {
    fontSize: 11, fontWeight: '700', color: C.grayDim,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  matchChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  matchChip: {
    borderWidth: 1.5, borderColor: 'rgba(45,106,79,0.40)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 50,
  },
  matchChipText: { fontSize: 13, fontWeight: '600', color: '#2D6A4F' },
  matchBtn: {
    backgroundColor: C.cta, paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 50, width: '100%', alignItems: 'center', marginBottom: 10,
  },
  matchBtnText: { color: C.white, fontWeight: '700', fontSize: 16 },
  matchBtnSecondary: { paddingVertical: 10, width: '100%', alignItems: 'center' },
  matchBtnSecondaryText: { color: C.gray, fontSize: 15, fontWeight: '500' },

});
