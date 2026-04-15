import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { fetchDiscoverProfiles, recordSwipe, type DiscoverProfile } from '../lib/discover';
import { getDiscoverUsage, recordDiscoverAction } from '../lib/dailyDiscoverUsage';
import { FREE_TIER_LIMITS } from '../lib/freeTierLimits';
import { usePurchases } from '../context/PurchasesContext';
import SwipeCard from '../components/SwipeCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Action = 'like' | 'pass' | 'top_pick';

export default function DiscoverScreen() {
  const { isRoomPearPlus, presentPaywall } = usePurchases();
  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actionDisabled, setActionDisabled] = useState(false);
  const [matchName, setMatchName] = useState<string | null>(null);
  const [expandedProfile, setExpandedProfile] = useState<DiscoverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyUsage, setDailyUsage] = useState({ swipes: 0, topPicks: 0 });

  // Animation values for the front card
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;

  const refreshDailyUsage = useCallback(async (uid: string) => {
    const u = await getDiscoverUsage(uid);
    setDailyUsage(u);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      if (uid) {
        loadProfiles(uid);
        refreshDailyUsage(uid);
      }
    });
  }, [refreshDailyUsage]);

  useFocusEffect(
    useCallback(() => {
      if (userId) refreshDailyUsage(userId);
    }, [userId, refreshDailyUsage])
  );

  async function loadProfiles(uid: string) {
    setLoading(true);
    const data = await fetchDiscoverProfiles(uid);
    setProfiles(data);
    setCurrentIndex(0);
    translateX.setValue(0);
    translateY.setValue(0);
    cardOpacity.setValue(1);
    setLoading(false);
  }

  // Animate the card flying off in the given direction, then advance to next
  function animateOut(direction: Action, onDone: () => void) {
    const toX =
      direction === 'like' ? SCREEN_WIDTH * 1.5
      : direction === 'pass' ? -SCREEN_WIDTH * 1.5
      : 0;
    const toY = direction === 'top_pick' ? -SCREEN_HEIGHT : 0;

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: toX,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: toY,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Reset values before content changes so new card appears at origin
      translateX.setValue(0);
      translateY.setValue(0);
      cardOpacity.setValue(1);
      onDone();
    });
  }

  async function handleAction(direction: Action) {
    if (actionDisabled) return;
    if (!userId) return;

    if (!isRoomPearPlus) {
      const usage = await getDiscoverUsage(userId);
      if (direction === 'top_pick') {
        if (
          usage.swipes >= FREE_TIER_LIMITS.swipesPerDay ||
          usage.topPicks >= FREE_TIER_LIMITS.topPicksPerDay
        ) {
          await presentPaywall();
          return;
        }
      } else if (usage.swipes >= FREE_TIER_LIMITS.swipesPerDay) {
        await presentPaywall();
        return;
      }
    }

    setActionDisabled(true);

    const current = profiles[currentIndex];

    animateOut(direction, async () => {
      if (current && userId) {
        const { isMatch } = await recordSwipe(userId, current.id, direction);
        if (isMatch) setMatchName(current.name);
        await recordDiscoverAction(userId, direction);
        await refreshDailyUsage(userId);
      }
      setCurrentIndex((prev) => prev + 1);
      setActionDisabled(false);
    });
  }

  async function handleUndo() {
    if (actionDisabled || currentIndex === 0) return;
    if (!isRoomPearPlus) {
      await presentPaywall();
      return;
    }
    setActionDisabled(true);
    cardOpacity.setValue(0);
    setCurrentIndex((prev) => prev - 1);
    Animated.timing(cardOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setActionDisabled(false));
  }

  const currentProfile = profiles[currentIndex];
  const nextProfile = profiles[currentIndex + 1];
  const remaining = profiles.length - currentIndex;

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Finding roommates…</Text>
      </View>
    );
  }

  if (!currentProfile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>You're all caught up</Text>
        <Text style={styles.emptyText}>No more profiles right now.{'\n'}Check back later!</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => userId && loadProfiles(userId)}
        >
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Discover</Text>
          {isRoomPearPlus ? (
            <Text style={styles.headerMetricsPremium}>RoomPear+ · Unlimited swipes & Top Picks</Text>
          ) : (
            <Text style={styles.headerMetrics}>
              {Math.max(0, FREE_TIER_LIMITS.swipesPerDay - dailyUsage.swipes)}/
              {FREE_TIER_LIMITS.swipesPerDay} swipes today ·{' '}
              {dailyUsage.topPicks >= FREE_TIER_LIMITS.topPicksPerDay ? 'Top Pick used' : 'Top Pick ready'}
            </Text>
          )}
        </View>
        <Text style={styles.headerCount}>
          {remaining} {remaining === 1 ? 'person' : 'people'} nearby
        </Text>
      </View>

      {/* ── Card stack ── */}
      <View style={styles.cardArea}>
        {/* Back card — static, slightly smaller */}
        {nextProfile && (
          <View style={styles.backCardWrap} pointerEvents="none">
            <SwipeCard profile={nextProfile} onPress={() => {}} />
          </View>
        )}

        {/* Front card — animated */}
        <Animated.View
          style={[
            styles.frontCardWrap,
            {
              transform: [{ translateX }, { translateY }],
              opacity: cardOpacity,
            },
          ]}
        >
          <SwipeCard
            profile={currentProfile}
            onPress={() => setExpandedProfile(currentProfile)}
          />
        </Animated.View>
      </View>

      {/* ── Action buttons ── */}
      <View style={styles.actions}>
        {/* Undo */}
        <TouchableOpacity
          style={[
            styles.btn,
            styles.btnUndo,
            (actionDisabled || currentIndex === 0) && styles.btnDisabled,
            !isRoomPearPlus && styles.btnUndoLocked,
          ]}
          onPress={() => void handleUndo()}
          disabled={actionDisabled || currentIndex === 0}
        >
          <Text style={[styles.btnIcon, styles.btnIconUndo]}>↩</Text>
        </TouchableOpacity>

        {/* Pass */}
        <TouchableOpacity
          style={[styles.btn, styles.btnPass, actionDisabled && styles.btnDisabled]}
          onPress={() => handleAction('pass')}
          disabled={actionDisabled}
        >
          <Text style={[styles.btnIcon, styles.btnIconPass]}>✕</Text>
        </TouchableOpacity>

        {/* Top Pick */}
        <TouchableOpacity
          style={[styles.btn, styles.btnTop, actionDisabled && styles.btnDisabled]}
          onPress={() => handleAction('top_pick')}
          disabled={actionDisabled}
        >
          <Text style={[styles.btnIcon, styles.btnIconTop]}>★</Text>
        </TouchableOpacity>

        {/* Like */}
        <TouchableOpacity
          style={[styles.btn, styles.btnLike, actionDisabled && styles.btnDisabled]}
          onPress={() => handleAction('like')}
          disabled={actionDisabled}
        >
          <Text style={[styles.btnIcon, styles.btnIconLike]}>♥</Text>
        </TouchableOpacity>
      </View>

      {/* ── Full profile modal ── */}
      <Modal visible={!!expandedProfile} animationType="slide" statusBarTranslucent>
        {expandedProfile && (
          <View style={styles.profileModal}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={{ height: SCREEN_HEIGHT * 0.55 }}
              >
                {expandedProfile.photoUrls.map((url, i) => (
                  <Image
                    key={i}
                    source={{ uri: url }}
                    style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.55 }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>

              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {expandedProfile.name}
                  {expandedProfile.age ? `, ${expandedProfile.age}` : ''}
                </Text>
                {expandedProfile.location ? (
                  <Text style={styles.profileLocation}>📍 {expandedProfile.location}</Text>
                ) : null}
                {expandedProfile.bio ? (
                  <Text style={styles.profileBio}>{expandedProfile.bio}</Text>
                ) : null}
                {expandedProfile.hobbies && expandedProfile.hobbies.length > 0 && (
                  <>
                    <Text style={styles.profileSectionLabel}>Interests</Text>
                    <View style={styles.profileChips}>
                      {expandedProfile.hobbies.map((h, i) => (
                        <View key={i} style={styles.profileChip}>
                          <Text style={styles.profileChipText}>{h}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnPass]}
                onPress={() => { setExpandedProfile(null); handleAction('pass'); }}
              >
                <Text style={[styles.btnIcon, styles.btnIconPass]}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnTop]}
                onPress={() => { setExpandedProfile(null); handleAction('top_pick'); }}
              >
                <Text style={[styles.btnIcon, styles.btnIconTop]}>★</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnLike]}
                onPress={() => { setExpandedProfile(null); handleAction('like'); }}
              >
                <Text style={[styles.btnIcon, styles.btnIconLike]}>♥</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setExpandedProfile(null)}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {/* ── Match modal ── */}
      <Modal visible={!!matchName} transparent animationType="fade">
        <View style={styles.matchOverlay}>
          <View style={styles.matchCard}>
            <Text style={styles.matchEmoji}>🍐</Text>
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Text style={styles.matchSub}>
              You and {matchName} both liked each other.{'\n'}Start the conversation!
            </Text>
            <TouchableOpacity
              style={styles.matchBtn}
              onPress={() => setMatchName(null)}
            >
              <Text style={styles.matchBtnText}>Keep Swiping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7F9',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#F4F7F9',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0C5389',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#4A6070',
    textAlign: 'center',
    lineHeight: 22,
  },
  refreshBtn: {
    marginTop: 24,
    backgroundColor: '#0C5389',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
  },
  refreshBtnText: {
    color: '#FDFDFD',
    fontWeight: '700',
    fontSize: 15,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0C5389',
  },
  headerMetrics: {
    marginTop: 4,
    fontSize: 12,
    color: '#4A6070',
    fontWeight: '600',
    lineHeight: 16,
  },
  headerMetricsPremium: {
    marginTop: 4,
    fontSize: 12,
    color: '#189AA2',
    fontWeight: '700',
  },
  headerCount: {
    fontSize: 13,
    color: '#189AA2',
    fontWeight: '600',
    marginTop: 4,
  },
  btnUndoLocked: {
    opacity: 0.55,
  },

  // Card area
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backCardWrap: {
    position: 'absolute',
    transform: [{ scale: 0.96 }, { translateY: 10 }],
    opacity: 0.7,
  },
  frontCardWrap: {
    position: 'absolute',
  },

  // Action buttons
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
    paddingBottom: 28,
    backgroundColor: '#F4F7F9',
  },
  btn: {
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDFDFD',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.35 },
  btnUndo: { width: 52, height: 52, borderWidth: 1.5, borderColor: '#C0CDD6' },
  btnPass: { width: 64, height: 64, borderWidth: 2, borderColor: '#E53935' },
  btnTop:  { width: 64, height: 64, borderWidth: 2, borderColor: '#F59E0B' },
  btnLike: { width: 72, height: 72, borderWidth: 2, borderColor: '#189AA2' },
  btnIcon: { fontSize: 24 },
  btnIconUndo: { color: '#9AA', fontSize: 20 },
  btnIconPass: { color: '#E53935' },
  btnIconTop:  { color: '#F59E0B' },
  btnIconLike: { color: '#189AA2', fontSize: 26 },

  // Full profile modal
  profileModal: {
    flex: 1,
    backgroundColor: '#FDFDFD',
  },
  profileInfo: {
    padding: 24,
    paddingBottom: 16,
  },
  profileName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0C5389',
  },
  profileLocation: {
    fontSize: 15,
    color: '#189AA2',
    fontWeight: '500',
    marginTop: 4,
  },
  profileBio: {
    fontSize: 15,
    color: '#4A6070',
    lineHeight: 22,
    marginTop: 16,
  },
  profileSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A6070',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  profileChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileChip: {
    backgroundColor: 'rgba(24,154,162,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  profileChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#189AA2',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 20,
    paddingBottom: 36,
    backgroundColor: '#FDFDFD',
    borderTopWidth: 1,
    borderTopColor: '#E8EEF2',
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FDFDFD',
    fontSize: 16,
    fontWeight: '700',
  },

  // Match modal
  matchOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchCard: {
    backgroundColor: '#FDFDFD',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  matchEmoji: { fontSize: 48, marginBottom: 12 },
  matchTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0C5389',
    marginBottom: 8,
  },
  matchSub: {
    fontSize: 15,
    color: '#4A6070',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  matchBtn: {
    backgroundColor: '#0C5389',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
  },
  matchBtnText: {
    color: '#FDFDFD',
    fontWeight: '700',
    fontSize: 15,
  },
});
