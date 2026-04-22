import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
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
import { usePurchases } from '../context/PurchasesContext';
import type { MainTabParamList } from '../navigation/MainTabNavigator';
import type { LikesStackParamList } from '../navigation/LikesStack';

type NavProp = CompositeNavigationProp<
  NativeStackNavigationProp<LikesStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 16;
const GRID_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

export default function LikesScreen() {
  const navigation = useNavigation<NavProp>();
  const { isRoomPearPlus, presentPaywall } = usePurchases();
  const [userId, setUserId] = useState<string | null>(null);
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [likedBackIds, setLikedBackIds] = useState<Set<string>>(new Set());
  /** True when today's free daily reveal has been consumed */
  const [dailyRevealSpentToday, setDailyRevealSpentToday] = useState(false);
  const [bonusRevealBalance, setBonusRevealBalance] = useState(0);
  const [matchName, setMatchName] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setUserId(uid);

    const { data: profile } = await supabase
      .from('profiles')
      .select('last_free_reveal_at, bonus_reveal_balance')
      .eq('id', uid)
      .single();

    const lastReveal: string | null = profile?.last_free_reveal_at ?? null;
    const usedToday =
      !!lastReveal && new Date(lastReveal).toDateString() === new Date().toDateString();
    setDailyRevealSpentToday(usedToday);
    setBonusRevealBalance(Math.max(0, Number(profile?.bonus_reveal_balance ?? 0)));

    const data = await fetchLikers(uid);
    setLikers(data);
    const persistedRevealed = await fetchPersistedRevealedIds(uid);
    const pendingIds = new Set(data.map((liker) => liker.id));
    const filteredRevealed = new Set(
      [...persistedRevealed].filter((likerId) => pendingIds.has(likerId))
    );
    setRevealedIds(filteredRevealed);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleLikeBack(liker: Liker) {
    if (!userId || likedBackIds.has(liker.id)) return;
    setLikedBackIds((prev) => new Set([...prev, liker.id]));
    const { isMatch } = await recordSwipe(userId, liker.id, 'like');
    if (isMatch) {
      setMatchName(liker.name);
    }
  }

  const canRevealMore = !dailyRevealSpentToday || bonusRevealBalance > 0;

  async function handleReveal(liker: Liker) {
    if (revealedIds.has(liker.id)) return;

    if (!canRevealMore) {
      Alert.alert(
        'No reveals left today',
        'Come back tomorrow for another free reveal, invite friends from Profile for bonus reveals, or upgrade to RoomPear+ to see every liker instantly.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'View RoomPear+', onPress: () => void presentPaywall() },
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

    const result = await consumeReveal(userId);
    if (result.success) {
      setRevealedIds((prev) => new Set([...prev, liker.id]));
      if (result.usedBonus) {
        setBonusRevealBalance((b) => Math.max(0, b - 1));
      } else {
        setDailyRevealSpentToday(true);
      }
    } else {
      await unpersistRevealedLiker(userId, liker.id);
      Alert.alert(
        'No reveals left today',
        'Come back tomorrow, invite friends from Profile for bonus reveals, or upgrade to RoomPear+ for unlimited access to your likers.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'View RoomPear+', onPress: () => void presentPaywall() },
        ]
      );
    }
  }

  function renderItem({ item }: { item: Liker }) {
    const isRevealed = revealedIds.has(item.id);
    const photoClear = isRoomPearPlus || isRevealed;
    const photo = item.photoUrls[0];

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={photoClear ? 0.85 : 1}
        onPress={() => {
          if (photoClear) navigation.navigate('ProfileView', { userId: item.id, name: item.name });
        }}
      >
        {/* Photo — blurred for free users until revealed; RoomPear+ sees all */}
        <View style={styles.photoWrap}>
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={styles.photo}
              resizeMode="cover"
              blurRadius={photoClear ? 0 : 18}
            />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Text style={styles.photoInitial}>
                {photoClear ? item.name.slice(0, 1) : '?'}
              </Text>
            </View>
          )}

          {!photoClear && (
            <View style={styles.lockOverlay} pointerEvents="none">
              <Text style={styles.lockIcon}>🔒</Text>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}{item.age ? `, ${item.age}` : ''}
          </Text>
          {!!item.location && (
            <Text style={styles.location} numberOfLines={1}>{item.location}</Text>
          )}

          {photoClear ? (
            <TouchableOpacity
              style={[styles.revealBtn, likedBackIds.has(item.id) && styles.revealBtnDim]}
              onPress={() => handleLikeBack(item)}
              disabled={likedBackIds.has(item.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.revealBtnText}>
                {likedBackIds.has(item.id) ? '✓ Liked back' : '💚 Like Back'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.revealBtn, !canRevealMore && styles.revealBtnDim]}
              onPress={() => {
                if (!canRevealMore) {
                  void presentPaywall();
                } else {
                  void handleReveal(item);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.revealBtnText}>
                {!canRevealMore ? '🔒 RoomPear+' : '✨ Reveal'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Likes</Text>
        {!loading && likers.length > 0 && (
          <Text style={styles.headerCount}>
            {likers.length} {likers.length === 1 ? 'person' : 'people'} liked you
          </Text>
        )}
      </View>

      {/* Reveal status banner */}
      {!loading && userId && likers.length > 0 && (
        <View
          style={[
            styles.banner,
            isRoomPearPlus && styles.bannerPremium,
            !canRevealMore && !isRoomPearPlus && styles.bannerUsed,
          ]}
        >
          <Text style={[styles.bannerText, isRoomPearPlus && styles.bannerTextPremium]}>
            {isRoomPearPlus
              ? 'RoomPear+ · All likers visible — unlimited reveals'
              : !dailyRevealSpentToday
                ? '✨ 1 free daily reveal available'
                : bonusRevealBalance > 0
                  ? `✨ ${bonusRevealBalance} bonus reveal${bonusRevealBalance === 1 ? '' : 's'} (referrals)`
                  : '🔒 No reveals left — come back tomorrow or invite friends (Profile)'}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0C5389" />
        </View>
      ) : (
        <FlatList
          data={likers}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={likers.length === 0 ? styles.emptyList : styles.gridContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#0C5389"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>💛</Text>
              <Text style={styles.emptyTitle}>No likes yet</Text>
              <Text style={styles.emptyText}>
                When someone likes your profile, they'll appear here.{'\n'}Keep swiping!
              </Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}
      {/* Match modal */}
      <Modal visible={!!matchName} transparent animationType="fade">
        <View style={styles.matchOverlay}>
          <View style={styles.matchCard}>
            <Text style={styles.matchEmoji}>🍐</Text>
            <Text style={styles.matchTitle}>It's a Match!</Text>
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
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0C5389',
  },
  headerCount: {
    fontSize: 13,
    color: '#189AA2',
    fontWeight: '600',
  },

  // Banner
  banner: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(24,154,162,0.12)',
  },
  bannerUsed: {
    backgroundColor: 'rgba(74,96,112,0.10)',
  },
  bannerPremium: {
    backgroundColor: 'rgba(70,189,127,0.15)',
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#189AA2',
    textAlign: 'center',
  },
  bannerTextPremium: {
    color: '#0C5389',
  },

  // Grid
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 32,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: GRID_GAP,
  },

  // Card
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    backgroundColor: '#FDFDFD',
    overflow: 'hidden',
    shadowColor: '#0C5389',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  photoWrap: {
    position: 'relative',
  },
  photo: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    backgroundColor: '#D9E1E6',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C0CDD6',
  },
  photoInitial: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FDFDFD',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    fontSize: 28,
  },
  info: {
    padding: 10,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0C5389',
    marginBottom: 2,
  },
  location: {
    fontSize: 12,
    color: '#189AA2',
    marginBottom: 8,
  },
  revealBtn: {
    backgroundColor: '#0C5389',
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  revealBtnDim: {
    backgroundColor: '#C0CDD6',
  },
  revealBtnText: {
    color: '#FDFDFD',
    fontSize: 13,
    fontWeight: '700',
  },

  // Empty
  emptyList: {
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
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
    fontSize: 26,
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
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  matchBtnText: {
    color: '#FDFDFD',
    fontWeight: '700',
    fontSize: 15,
  },
  matchSkip: {
    fontSize: 14,
    color: '#4A6070',
    opacity: 0.7,
  },
});
