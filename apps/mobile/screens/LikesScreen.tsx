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
import { hasRoomPearPlusEntitlement, isPremiumProfileTier } from '../lib/purchasesConfig';
import type { MainTabParamList } from '../navigation/MainTabNavigator';
import type { LikesStackParamList } from '../navigation/LikesStack';
import {
  CHATS_SCREEN_BG,
  CHATS_CARD,
  CHATS_GREEN,
  CHATS_GREEN_BORDER,
  CHATS_GREEN_BORDER_STRONG,
  CHATS_GREEN_DARK,
  CHATS_GREEN_SOFT_BG,
} from '../theme/chatsAmbient';

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
  text: '#1A2C24',
  gray: '#717182',
  grayDim: '#A0A0B0',
  white: '#FFFFFF',
  surface: CHATS_CARD,
  surfaceBorder: CHATS_GREEN_BORDER,
  accent: CHATS_GREEN,
  accentSoft: CHATS_GREEN_SOFT_BG,
};

function Background({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: CHATS_SCREEN_BG }}>{children}</View>;
}

/** Likes-only ambient layers — moss tones, asymmetric glow (Chats stays flat). */
function LikesAmbientBackdrop() {
  return (
    <View style={styles.ambientRoot} pointerEvents="none">
      <View style={styles.ambientOrbTopRight} />
      <View style={styles.ambientOrbBottomLeft} />
      <LinearGradient
        colors={[
          'rgba(250, 252, 251, 0)',
          'rgba(45, 106, 79, 0.035)',
          'rgba(250, 252, 251, 0)',
        ]}
        locations={[0, 0.48, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['rgba(45, 106, 79, 0.11)', 'rgba(250, 252, 251, 0)']}
        locations={[0, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.25, y: 0.6 }}
        style={styles.ambientCornerGlow}
      />
      <View style={styles.heroGlow}>
        <LinearGradient
          colors={['rgba(45, 106, 79, 0.14)', 'rgba(250, 252, 251, 0)']}
          locations={[0, 1]}
          style={styles.heroGradientFill}
        />
      </View>
    </View>
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
    const { data: tierRow } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', uid)
      .maybeSingle();
    const isPremiumTier = isPremiumProfileTier(tierRow?.subscription_tier as string | undefined);
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

  useFocusEffect(
    useCallback(() => {
      void load(false, true);
    }, [load])
  );

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
                  <Ionicons name="lock-closed" size={22} color={CHATS_GREEN} />
                </View>
              </View>
            )}

            {item.usedTopPick && (
              <View style={styles.topPickBadge} pointerEvents="none">
                <Ionicons name="star" size={11} color={CHATS_GREEN} />
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
      <LikesAmbientBackdrop />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.heroTitle}>Likes</Text>
          <Text style={styles.heroTagline}>People who chose you — reveal photos on your terms</Text>
        </View>

        {!loading && likers.length > 0 && (
          <View style={styles.statRow}>
            <View style={styles.statPill}>
              <Ionicons name="heart" size={16} color={CHATS_GREEN} />
              <Text style={styles.statPillText}>
                {likers.length} {likers.length === 1 ? 'person' : 'people'}
              </Text>
            </View>
          </View>
        )}

        {!loading && userId && likers.length > 0 && (
          <View
            style={[
              styles.revealCard,
              revealSummary.tone === 'plus' && styles.revealCardPlus,
              revealSummary.tone === 'used' && styles.revealCardUsed,
            ]}
          >
            <View
              style={[
                styles.revealAccent,
                revealSummary.tone === 'plus' && styles.revealAccentPlus,
                revealSummary.tone === 'used' && styles.revealAccentUsed,
              ]}
            />
            <View style={styles.revealCardInner}>
              <View
                style={[
                  styles.revealIconWrap,
                  revealSummary.tone === 'used' && styles.revealIconWrapMuted,
                ]}
              >
                <Ionicons
                  name={revealSummary.icon}
                  size={22}
                  color={
                    revealSummary.tone === 'plus'
                      ? CHATS_GREEN
                      : revealSummary.tone === 'used'
                        ? C.gray
                        : CHATS_GREEN
                  }
                />
              </View>
              <View style={styles.revealCopy}>
                <Text style={styles.revealTitle}>{revealSummary.title}</Text>
                <Text style={styles.revealBody}>{revealSummary.body}</Text>
              </View>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={CHATS_GREEN} />
          </View>
        ) : (
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
                  tintColor={CHATS_GREEN}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyEmoji}>💛</Text>
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
              <Text style={styles.matchEmoji}>🍐</Text>
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
    zIndex: 1,
  },
  ambientRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    overflow: 'hidden',
  },
  ambientOrbTopRight: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.92,
    height: SCREEN_WIDTH * 0.92,
    borderRadius: SCREEN_WIDTH * 0.46,
    top: -SCREEN_WIDTH * 0.38,
    right: -SCREEN_WIDTH * 0.28,
    backgroundColor: 'rgba(45, 106, 79, 0.06)',
  },
  ambientOrbBottomLeft: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.75,
    borderRadius: SCREEN_WIDTH * 0.375,
    bottom: -SCREEN_WIDTH * 0.22,
    left: -SCREEN_WIDTH * 0.32,
    backgroundColor: 'rgba(26, 51, 41, 0.045)',
  },
  ambientCornerGlow: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: SCREEN_WIDTH * 0.72,
    height: SCREEN_WIDTH * 0.58,
  },
  heroGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 168,
  },
  heroGradientFill: {
    flex: 1,
    width: '100%',
    minHeight: 168,
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
    fontSize: 28,
    fontWeight: '600',
    color: C.text,
    letterSpacing: -0.5,
  },
  heroTagline: {
    fontSize: 13,
    fontWeight: '500',
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
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: CHATS_GREEN_BORDER,
  },
  statPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: CHATS_GREEN_DARK,
  },
  revealCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  revealCardPlus: {
    borderColor: CHATS_GREEN,
    backgroundColor: CHATS_GREEN_SOFT_BG,
  },
  revealCardUsed: {
    backgroundColor: 'rgba(113, 113, 130, 0.06)',
    borderColor: CHATS_GREEN_BORDER,
  },
  revealAccent: {
    width: 5,
    backgroundColor: CHATS_GREEN,
  },
  revealAccentPlus: {
    backgroundColor: CHATS_GREEN,
  },
  revealAccentUsed: {
    backgroundColor: C.grayDim,
  },
  revealCardInner: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
    alignItems: 'center',
  },
  revealIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CHATS_GREEN_SOFT_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CHATS_GREEN_BORDER,
  },
  revealIconWrapMuted: {
    backgroundColor: 'rgba(113, 113, 130, 0.10)',
    borderColor: 'rgba(113, 113, 130, 0.22)',
  },
  revealCopy: {
    flex: 1,
    minWidth: 0,
  },
  revealTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: CHATS_GREEN_DARK,
    marginBottom: 2,
  },
  revealBody: {
    fontSize: 13,
    fontWeight: '500',
    color: C.gray,
    lineHeight: 18,
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
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: CHATS_GREEN_BORDER,
  },
  sortChipActive: {
    backgroundColor: CHATS_GREEN_SOFT_BG,
    borderColor: CHATS_GREEN,
  },
  sortChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.gray,
  },
  sortChipTextActive: {
    color: CHATS_GREEN,
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
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  photoWrap: {
    position: 'relative',
  },
  gridPhoto: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    backgroundColor: CHATS_GREEN_SOFT_BG,
  },
  gridPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CHATS_GREEN,
  },
  gridPhotoInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: C.white,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250, 252, 251, 0.45)',
  },
  lockBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: CHATS_CARD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CHATS_GREEN_BORDER_STRONG,
    shadowColor: '#1A3329',
    shadowOpacity: 0.12,
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
    borderRadius: 12,
    backgroundColor: CHATS_CARD,
    borderWidth: 1.5,
    borderColor: CHATS_GREEN,
    zIndex: 2,
    shadowColor: '#1A3329',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  topPickBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: CHATS_GREEN_DARK,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  gridInfo: {
    padding: 10,
  },
  gridName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    marginBottom: 2,
  },
  gridLocation: {
    fontSize: 12,
    fontWeight: '500',
    color: C.accent,
    marginBottom: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CHATS_GREEN,
    borderRadius: 12,
    paddingVertical: 8,
  },
  actionBtnMuted: {
    backgroundColor: C.grayDim,
  },
  actionBtnText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: C.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
  matchOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchCard: {
    backgroundColor: CHATS_CARD,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '80%',
    borderWidth: 1,
    borderColor: CHATS_GREEN_BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  matchEmoji: { fontSize: 48, marginBottom: 12 },
  matchTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: CHATS_GREEN_DARK,
    marginBottom: 8,
  },
  matchSub: {
    fontSize: 15,
    fontWeight: '500',
    color: C.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  matchBtn: {
    backgroundColor: CHATS_GREEN,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  matchBtnText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 15,
  },
  matchSkip: {
    fontSize: 14,
    fontWeight: '500',
    color: C.gray,
    opacity: 0.85,
  },
});
