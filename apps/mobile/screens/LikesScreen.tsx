import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts } from '../lib/typography';
import { supabase } from '../lib/supabase';
import {
  fetchLikers,
  fetchPersistedRevealedIds,
  consumeReveal,
  persistRevealedLiker,
  unpersistRevealedLiker,
  type Liker,
} from '../lib/likes';
import { recordSwipe } from '../lib/discover';
import { isSameLaCalendarDay } from '../lib/usageDay';
import { usePurchases } from '../context/PurchasesContext';
import { hasRoomPearPlusEntitlement } from '../lib/purchasesConfig';
import { fetchProfileIsPremium } from '../lib/profileSubscriptionTier';
import type { MainTabParamList } from '../navigation/MainTabNavigator';
import type { LikesStackParamList } from '../navigation/LikesStack';

type NavProp = CompositeNavigationProp<
  NativeStackNavigationProp<LikesStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;

type SortBy = 'recent' | 'name';

/** Skip silent refetch on tab refocus if data was loaded recently (pull-to-refresh always bypasses). */
const FOCUS_STALE_MS = 90_000;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 16;
const GRID_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

const C = {
  text: '#111111',
  gray: '#717182',
  grayDim: '#A0A0B0',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceBorder: 'rgba(0,0,0,0.07)',
  green: '#2D6A4F',
  greenSoft: 'rgba(45,106,79,0.10)',
  greenBorder: 'rgba(45,106,79,0.16)',
};

function Background({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={['#EDF5EA', '#F4F9F0', '#FAFDF7', '#FFFFFF']}
      locations={[0, 0.3, 0.65, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    >
      {children}
    </LinearGradient>
  );
}

export default function LikesScreen() {
  const navigation = useNavigation<NavProp>();
  const { isRoomPearPlus, customerInfo, presentPaywall } = usePurchases();
  const [hasPremiumTier, setHasPremiumTier] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [likedBackIds, setLikedBackIds] = useState<Set<string>>(new Set());
  const [dailyRevealSpentToday, setDailyRevealSpentToday] = useState(false);
  const [bonusRevealBalance, setBonusRevealBalance] = useState(0);
  const [matchName, setMatchName] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('recent');

  /** Same pattern as Chats: no full-screen spinner on every tab focus; optional stale skip avoids redundant fetches. */
  const initialLoadDoneRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const lastFetchedAtRef = useRef(0);
  const likersRef = useRef<Liker[]>([]);
  useEffect(() => {
    likersRef.current = likers;
  }, [likers]);

  const refreshRevealQuota = useCallback(async (uid: string) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('last_free_reveal_at, bonus_reveal_balance')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      console.warn('refreshRevealQuota', error.message);
      return;
    }

    const lastReveal: string | null = profile?.last_free_reveal_at ?? null;
    const usedToday = !!lastReveal && isSameLaCalendarDay(lastReveal, new Date());
    setDailyRevealSpentToday(usedToday);
    setBonusRevealBalance(Math.max(0, Number(profile?.bonus_reveal_balance ?? 0)));
  }, []);

  const load = useCallback(async (isRefresh = false, skipIfFresh = false) => {
    if (isRefresh) setRefreshing(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) {
      setUserId(null);
      setHasPremiumTier(false);
      setLikers([]);
      setRevealedIds(new Set());
      setLikedBackIds(new Set());
      setLoading(false);
      setRefreshing(false);
      initialLoadDoneRef.current = false;
      lastUserIdRef.current = null;
      lastFetchedAtRef.current = 0;
      return;
    }

    if (lastUserIdRef.current !== uid) {
      if (lastUserIdRef.current !== null) {
        setLikers([]);
        setRevealedIds(new Set());
        setLikedBackIds(new Set());
      }
      initialLoadDoneRef.current = false;
      lastUserIdRef.current = uid;
      lastFetchedAtRef.current = 0;
    }

    const firstLoadForUser = !initialLoadDoneRef.current;
    if (!isRefresh && firstLoadForUser) setLoading(true);

    setUserId(uid);
    // Always re-sync subscription (DB + RC) on every load — must run *before* the stale-focus
    // short-circuit or premium users can stay stuck on blurred / “reveal” UI after purchase.
    const isPremiumTier = await fetchProfileIsPremium(uid);
    setHasPremiumTier(isPremiumTier);
    const hasPremiumAccess = hasRoomPearPlusEntitlement(customerInfo) || isRoomPearPlus || isPremiumTier;
    if (hasPremiumAccess && likersRef.current.length > 0) {
      setRevealedIds(new Set(likersRef.current.map((l) => l.id)));
    }

    // Always sync quota from DB before the stale-focus short-circuit, or banner / canReveal can
    // disagree with the server after a consume on another tab or stale local state.
    await refreshRevealQuota(uid);

    if (
      skipIfFresh &&
      initialLoadDoneRef.current &&
      !isRefresh &&
      Date.now() - lastFetchedAtRef.current < FOCUS_STALE_MS
    ) {
      setRefreshing(false);
      setLoading(false);
      return;
    }

    const data = await fetchLikers(uid);
    setLikers(data);
    const persistedRevealed = await fetchPersistedRevealedIds(uid);
    const pendingIds = new Set(data.map((liker) => liker.id));
    const filteredRevealed = new Set(
      [...persistedRevealed].filter((likerId) => pendingIds.has(likerId))
    );
    setRevealedIds(hasPremiumAccess ? new Set(data.map((liker) => liker.id)) : filteredRevealed);
    initialLoadDoneRef.current = true;
    lastFetchedAtRef.current = Date.now();
    setLoading(false);
    setRefreshing(false);
  }, [isRoomPearPlus, customerInfo, refreshRevealQuota]);

  /** When RC / DB flips to paid while you stay on this tab, or likers list arrives after premium, unlock all. */
  useEffect(() => {
    if (!userId) return;
    const paid =
      hasRoomPearPlusEntitlement(customerInfo) || isRoomPearPlus || hasPremiumTier;
    if (!paid) return;
    if (likers.length === 0) return;
    setRevealedIds(new Set(likers.map((l) => l.id)));
  }, [userId, customerInfo, isRoomPearPlus, hasPremiumTier, likers]);

  /** Keep `profiles.subscription_tier` in sync when RevenueCat updates (purchase / restore) without leaving the tab. */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const premium = await fetchProfileIsPremium(userId);
      if (!cancelled) setHasPremiumTier(premium);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, customerInfo]);

  useFocusEffect(
    useCallback(() => {
      void load(false, true);
    }, [load])
  );

  useEffect(() => {
    void load(false, true);
  }, [load]);

  const sortedLikers = useMemo(() => {
    const copy = [...likers];
    if (sortBy === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy.sort((a, b) => b.likedAt.localeCompare(a.likedAt));
  }, [likers, sortBy]);

  const hasPremiumAccess =
    hasRoomPearPlusEntitlement(customerInfo) || isRoomPearPlus || hasPremiumTier;
  const canRevealMore = hasPremiumAccess || !dailyRevealSpentToday || bonusRevealBalance > 0;
  const openPaywallIfNeeded = useCallback(async () => {
    if (hasPremiumAccess) return;
    await presentPaywall();
  }, [hasPremiumAccess, presentPaywall]);

  async function handleLikeBack(liker: Liker) {
    if (!userId || likedBackIds.has(liker.id)) return;
    setLikedBackIds((prev) => new Set([...prev, liker.id]));
    const { isMatch } = await recordSwipe(userId, liker.id, 'like');
    if (isMatch) {
      setMatchName(liker.name);
    }
  }

  async function handleReveal(liker: Liker) {
    if (hasPremiumAccess) return;
    if (revealedIds.has(liker.id)) return;

    if (!canRevealMore) {
      Alert.alert(
        'No reveals left today',
        'Come back tomorrow for another free reveal, invite friends from Profile for bonus reveals, or upgrade to RoomPear+ to see every liker instantly.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'View RoomPear+', onPress: () => void openPaywallIfNeeded() },
        ]
      );
      return;
    }

    if (!userId) return;

    const persisted = await persistRevealedLiker(userId, liker.id);
    if (!persisted) {
      Alert.alert(
        'Reveal failed',
        'Could not save this reveal right now. Please try again.'
      );
      return;
    }

    const result = await consumeReveal();
    if (result.success) {
      setRevealedIds((prev) => new Set([...prev, liker.id]));
      if (result.usedBonus) {
        setBonusRevealBalance((b) => Math.max(0, b - 1));
      } else {
        setDailyRevealSpentToday(true);
      }
    } else {
      await unpersistRevealedLiker(userId, liker.id);
      await refreshRevealQuota(userId);
      const rpcDown = result.reason === 'rpc_failed';
      Alert.alert(
        rpcDown ? 'Reveal unavailable' : 'No reveals left today',
        rpcDown
          ? "We couldn't confirm your reveal quota. Check your connection and try again.\nIf this keeps happening, the app server may need the latest migrations."
          : 'Come back tomorrow, invite friends from Profile for bonus reveals, or upgrade to RoomPear+ for unlimited access to your likers.',
        rpcDown
          ? [{ text: 'OK', style: 'cancel' }]
          : [
              { text: 'Not now', style: 'cancel' },
              { text: 'View RoomPear+', onPress: () => void openPaywallIfNeeded() },
            ]
      );
    }
  }

  const revealSummary = hasPremiumAccess
    ? {
        icon: 'checkmark-circle' as const,
        title: 'RoomPear+',
        body: 'All likers are visible — unlimited reveals.',
        tone: 'plus' as const,
      }
    : !dailyRevealSpentToday
      ? {
          icon: 'sparkles' as const,
          title: 'Daily reveal',
          body: 'You have 1 free reveal today. Tap a card to unlock their photo.',
          tone: 'ready' as const,
        }
      : bonusRevealBalance > 0
        ? {
            icon: 'gift-outline' as const,
            title: 'Bonus reveals',
            body: `${bonusRevealBalance} referral bonus reveal${bonusRevealBalance === 1 ? '' : 's'} available.`,
            tone: 'ready' as const,
          }
        : {
            icon: 'moon' as const,
            title: 'Come back tomorrow',
            body: 'No reveals left today — invite friends from Profile for bonus reveals.',
            tone: 'used' as const,
          };

  function renderItem({ item }: { item: Liker }) {
    const isRevealed = revealedIds.has(item.id);
    // Premium: RC entitlement and/or `profiles.subscription_tier` (must match load + useEffect).
    const photoClear = hasPremiumAccess || isRevealed;
    const photo = item.photoUrls[0];

    return (
      <View style={styles.gridCard}>
        <TouchableOpacity
          activeOpacity={photoClear ? 0.85 : 1}
          onPress={() => {
            if (photoClear) {
              navigation.navigate('ProfileView', {
                userId: item.id,
                name: item.name,
                profileSource: 'likes',
              });
            }
          }}
        >
          <View style={styles.photoWrap}>
            {photo ? (
              <Image
                key={`${item.id}-${photoClear ? 'clear' : 'blurred'}`}
                source={{ uri: photo, cacheKey: photo }}
                style={styles.gridPhoto}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={`${item.id}-${photoClear ? 'c' : 'b'}`}
                transition={0}
                blurRadius={photoClear ? 0 : 70}
              />
            ) : (
              <View style={[styles.gridPhoto, styles.gridPhotoPlaceholder]}>
                <Text style={styles.gridPhotoInitial}>
                  {photoClear ? item.name.slice(0, 1) : '?'}
                </Text>
              </View>
            )}

            {!photoClear && (
              <View style={styles.lockOverlay} pointerEvents="none">
                <View style={styles.lockBubble}>
                  <Ionicons name="lock-closed" size={22} color="#111111" />
                </View>
              </View>
            )}

            {item.usedTopPick && (
              <View style={styles.topPickBadge} pointerEvents="none">
                <Ionicons name="star" size={11} color="#111111" />
                <Text style={styles.topPickBadgeText}>Top pick</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.gridInfo}>
          <Text style={styles.gridName} numberOfLines={1}>
            {item.name}
            {item.age ? `, ${item.age}` : ''}
          </Text>
          {!!item.location && (
            <Text style={styles.gridLocation} numberOfLines={1}>
              {item.location}
            </Text>
          )}

          {photoClear ? (
            <TouchableOpacity
              style={[styles.actionBtn, likedBackIds.has(item.id) && styles.actionBtnMuted]}
              onPress={() => handleLikeBack(item)}
              disabled={likedBackIds.has(item.id)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={likedBackIds.has(item.id) ? 'checkmark-circle' : 'heart'}
                size={16}
                color={C.white}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.actionBtnText}>
                {likedBackIds.has(item.id) ? 'Liked back' : 'Like back'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, !canRevealMore && styles.actionBtnMuted]}
              onPress={() => {
                if (!canRevealMore) {
                  void openPaywallIfNeeded();
                } else {
                  void handleReveal(item);
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={!canRevealMore ? 'star' : 'sparkles'}
                size={16}
                color={C.white}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.actionBtnText}>
                {!canRevealMore ? 'RoomPear+' : 'Reveal'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <Background>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.heroTitle}>Likes</Text>
          <Text style={styles.heroTagline}>People who chose you — reveal photos on your terms</Text>
        </View>

        {!loading && userId && likers.length > 0 && (
          <View style={[styles.revealPill, revealSummary.tone === 'used' && styles.revealPillMuted]}>
            <Ionicons
              name={revealSummary.icon}
              size={13}
              color={revealSummary.tone === 'used' ? C.grayDim : '#2D6A4F'}
            />
            <Text style={[styles.revealPillText, revealSummary.tone === 'used' && styles.revealPillTextMuted]}>
              {revealSummary.body}
            </Text>
          </View>
        )}

        {!loading && (
          <>
            {sortedLikers.length > 0 && (
              <View style={styles.sortRow}>
                <TouchableOpacity
                  style={[styles.sortChip, sortBy === 'recent' && styles.sortChipActive]}
                  onPress={() => setSortBy('recent')}
                >
                  <Text style={[styles.sortChipText, sortBy === 'recent' && styles.sortChipTextActive]}>
                    Recent
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortChip, sortBy === 'name' && styles.sortChipActive]}
                  onPress={() => setSortBy('name')}
                >
                  <Text style={[styles.sortChipText, sortBy === 'name' && styles.sortChipTextActive]}>
                    Name
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <FlatList
              data={sortedLikers}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={sortedLikers.length === 0 ? styles.emptyList : styles.gridContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => load(true)}
                  tintColor="#2D6A4F"
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Ionicons name="heart-outline" size={44} color="#C84200" style={{ marginBottom: 10 }} />
                  <Text style={styles.emptyTitle}>No likes yet</Text>
                  <Text style={styles.emptyText}>
                    When someone likes your profile, they will show up here. Keep swiping in Discover.
                  </Text>
                </View>
              }
              renderItem={renderItem}
            />
          </>
        )}

        <Modal visible={!!matchName} transparent animationType="fade">
          <View style={styles.matchOverlay}>
            <View style={styles.matchCard}>
              <Ionicons name="heart-circle-outline" size={48} color="#C84200" style={{ marginBottom: 12 }} />
              <Text style={styles.matchTitle}>{"It's a Match!"}</Text>
              <Text style={styles.matchSub}>
                You and {matchName} both liked each other.
              </Text>
              <TouchableOpacity
                style={styles.matchBtn}
                onPress={() => {
                  setMatchName(null);
                  navigation.navigate('Chats', { screen: 'ChatsHome' });
                }}
              >
                <Text style={styles.matchBtnText}>Send Message</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMatchName(null)}>
                <Text style={styles.matchSkip}>Keep Browsing</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
  },
  heroTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 28,
    color: '#111111',
    letterSpacing: -0.5,
  },
  heroTagline: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: C.gray,
    marginTop: 4,
    lineHeight: 18,
  },
  statRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.10)',
  },
  statPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#111111',
  },
  revealPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(45,106,79,0.08)',
  },
  revealPillMuted: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  revealPillText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#2D6A4F',
    flexShrink: 1,
  },
  revealPillTextMuted: {
    color: C.grayDim,
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.10)',
  },
  sortChipActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  sortChipText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: C.gray,
  },
  sortChipTextActive: {
    color: '#FFFFFF',
  },
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 32,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: GRID_GAP,
  },
  gridCard: {
    width: CARD_WIDTH,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.07)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  photoWrap: {
    position: 'relative',
  },
  gridPhoto: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    backgroundColor: '#EDF5EA',
  },
  gridPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D6A4F',
  },
  gridPhotoInitial: {
    fontFamily: fonts.bold,
    fontSize: 36,
    color: C.white,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(237,245,234,0.50)',
  },
  lockBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.10)',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  topPickBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.10)',
    zIndex: 2,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 3,
  },
  topPickBadgeText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    color: '#111111',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  gridInfo: {
    padding: 10,
  },
  gridName: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#111111',
    marginBottom: 2,
  },
  gridLocation: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: C.gray,
    marginBottom: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    borderRadius: 10,
    paddingVertical: 8,
  },
  actionBtnMuted: {
    backgroundColor: C.grayDim,
  },
  actionBtnText: {
    fontFamily: fonts.bold,
    color: C.white,
    fontSize: 13,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyCard: {
    alignSelf: 'center',
    maxWidth: 340,
    marginTop: 48,
    marginHorizontal: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: '#111111',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: C.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
  matchOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.60)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '82%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  matchEmoji: { fontSize: 48, marginBottom: 12 },
  matchTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    color: '#111111',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  matchSub: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: C.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  matchBtn: {
    backgroundColor: '#111111',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  matchBtnText: {
    fontFamily: fonts.bold,
    color: C.white,
    fontSize: 15,
  },
  matchSkip: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: C.gray,
  },
});
