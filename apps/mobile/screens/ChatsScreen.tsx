import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatsStackParamList } from '../navigation/ChatsStack';
import { fetchMatches, type Match } from '../lib/matches';
import { fetchConversationSummaries, type ConversationSummary } from '../lib/messaging';
import { supabase } from '../lib/supabase';
import {
  CHATS_SCREEN_BG,
  CHATS_CARD,
  CHATS_GREEN,
  CHATS_GREEN_BORDER,
  CHATS_GREEN_SOFT_BG,
} from '../theme/chatsAmbient';

type Props = NativeStackScreenProps<ChatsStackParamList, 'ChatsHome'>;
type SubTab = 'matched' | 'messages';
type SortBy = 'recent' | 'name';

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
  cta: '#030213',
  accent: CHATS_GREEN,
  destructive: '#D4183D',
};

function Background({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: CHATS_SCREEN_BG }}>{children}</View>;
}

function formatMatchDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatConvTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ChatsScreen({ navigation }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('matched');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [matches, setMatches] = useState<Match[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /** Avoid full-screen spinner + list remount on every tab focus — keeps expo-image cache warm. */
  const initialLoadDoneRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) {
      setLoading(false);
      setRefreshing(false);
      initialLoadDoneRef.current = false;
      lastUserIdRef.current = null;
      return;
    }

    if (lastUserIdRef.current !== uid) {
      if (lastUserIdRef.current !== null) {
        setMatches([]);
        setConversations([]);
      }
      initialLoadDoneRef.current = false;
      lastUserIdRef.current = uid;
    }

    const firstLoadForUser = !initialLoadDoneRef.current;
    if (!isRefresh && firstLoadForUser) setLoading(true);

    const [matchData, { data: convData }] = await Promise.all([
      fetchMatches(uid),
      fetchConversationSummaries(),
    ]);

    setMatches(matchData);
    setConversations(convData ?? []);
    initialLoadDoneRef.current = true;
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sortedMatches = [...matches].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return b.matchedAt.localeCompare(a.matchedAt);
  });

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  function renderMatchItem({ item }: { item: Match }) {
    return (
      <View style={styles.gridCard}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ProfileView', { userId: item.id, name: item.name })}
        >
          {item.photoUrls.length > 0 ? (
            <Image
              source={{
                uri: item.photoUrls[0],
                cacheKey: item.primaryPhotoCacheKey ?? item.photoUrls[0],
              }}
              style={styles.gridPhoto}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={item.primaryPhotoCacheKey ?? item.photoUrls[0]}
              transition={0}
            />
          ) : (
            <View style={[styles.gridPhoto, styles.gridPhotoPlaceholder]}>
              <Text style={styles.gridPhotoInitial}>{item.name.slice(0, 1)}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.gridInfo}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Chat', { otherUserId: item.id, title: item.name })}
        >
          <Text style={styles.gridName} numberOfLines={1}>
            {item.name}{item.age ? `, ${item.age}` : ''}
          </Text>
          {!!item.location && (
            <Text style={styles.gridLocation} numberOfLines={1}>{item.location}</Text>
          )}
          <Text style={styles.gridMatched}>Tap to message · {formatMatchDate(item.matchedAt)}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderConvItem({ item }: { item: ConversationSummary }) {
    return (
      <TouchableOpacity
        style={styles.convRow}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('Chat', {
            conversationId: item.conversationId,
            title: item.otherDisplayName,
          })
        }
      >
        <TouchableOpacity
          onPress={() => navigation.navigate('ProfileView', { userId: item.otherUserId, name: item.otherDisplayName })}
          activeOpacity={0.8}
        >
          <View style={styles.convAvatar}>
            {item.otherAvatarUrl ? (
              <Image
                source={{
                  uri: item.otherAvatarUrl,
                  cacheKey: item.otherAvatarCacheKey ?? item.otherAvatarUrl,
                }}
                style={styles.convAvatarImg}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={item.otherAvatarCacheKey ?? item.otherAvatarUrl}
                transition={0}
              />
            ) : (
              <Text style={styles.convAvatarText}>
                {item.otherDisplayName.slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.convBody}>
          <View style={styles.convTop}>
            <Text style={styles.convName} numberOfLines={1}>{item.otherDisplayName}</Text>
            <Text style={styles.convTime}>
              {formatConvTime(item.lastMessageAt ?? item.conversationCreatedAt)}
            </Text>
          </View>
          <View style={styles.convPreviewRow}>
            <Text style={styles.convPreview} numberOfLines={1}>
              {item.lastMessagePreview ?? 'No messages yet'}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unreadCount > 99 ? '99+' : String(item.unreadCount)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <Background>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.heroTitle}>Chats</Text>
          <Text style={styles.heroTagline}>Matches and messages in one place</Text>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabPill, subTab === 'matched' && styles.tabPillActive]}
            onPress={() => setSubTab('matched')}
          >
            <Text style={[styles.tabPillText, subTab === 'matched' && styles.tabPillTextActive]}>
              Matched{matches.length > 0 ? ` (${matches.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPill, subTab === 'messages' && styles.tabPillActive]}
            onPress={() => setSubTab('messages')}
          >
            <Text style={[styles.tabPillText, subTab === 'messages' && styles.tabPillTextActive]}>
              Messages
            </Text>
            {totalUnread > 0 && subTab !== 'messages' && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>
                  {totalUnread > 99 ? '99+' : String(totalUnread)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={CHATS_GREEN} />
          </View>
        ) : subTab === 'matched' ? (
          <>
            {sortedMatches.length > 0 && (
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
              data={sortedMatches}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={CHATS_GREEN} />
              }
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyEmoji}>🍐</Text>
                  <Text style={styles.emptyTitle}>No matches yet</Text>
                  <Text style={styles.emptyText}>
                    When you and someone both like each other, they'll show up here.
                  </Text>
                </View>
              }
              renderItem={renderMatchItem}
            />
          </>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.conversationId}
            contentContainerStyle={
              conversations.length === 0 ? styles.gridContent : styles.msgListContent
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={CHATS_GREEN} />
            }
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyText}>
                  Match with someone and send them the first message!
                </Text>
              </View>
            }
            renderItem={renderConvItem}
          />
        )}
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
    paddingBottom: 14,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: C.text,
    letterSpacing: -0.5,
  },
  heroTagline: {
    fontSize: 13,
    color: C.gray,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 14,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: CHATS_GREEN_BORDER,
    gap: 6,
  },
  tabPillActive: {
    backgroundColor: CHATS_GREEN_SOFT_BG,
    borderColor: CHATS_GREEN,
    shadowColor: CHATS_GREEN,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  tabPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.gray,
  },
  tabPillTextActive: {
    color: C.text,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: C.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '700',
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
  gridPhoto: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    backgroundColor: CHATS_GREEN_SOFT_BG,
  },
  gridPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
  },
  gridPhotoInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: C.white,
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
    marginBottom: 4,
  },
  gridMatched: {
    fontSize: 11,
    fontWeight: '500',
    color: C.gray,
  },
  msgListContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  convAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: CHATS_GREEN_BORDER,
  },
  convAvatarImg: {
    width: 52,
    height: 52,
  },
  convAvatarText: {
    color: C.white,
    fontSize: 20,
    fontWeight: '700',
  },
  convBody: {
    flex: 1,
    minWidth: 0,
  },
  convTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  convName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
  },
  convTime: {
    fontSize: 12,
    fontWeight: '500',
    color: C.grayDim,
  },
  convPreviewRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  convPreview: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: C.gray,
    lineHeight: 19,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: C.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    alignSelf: 'center',
    maxWidth: 340,
    marginTop: 48,
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
});
