import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatsStackParamList } from '../navigation/ChatsStack';
import { fetchMatches, type Match } from '../lib/matches';
import { fetchConversationSummaries, type ConversationSummary } from '../lib/messaging';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<ChatsStackParamList, 'ChatsHome'>;
type SubTab = 'matched' | 'messages';
type SortBy = 'recent' | 'name';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 16;
const GRID_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

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

    const [matchData, { data: convData }] = await Promise.all([
      fetchMatches(uid),
      fetchConversationSummaries(),
    ]);

    setMatches(matchData);
    setConversations(convData ?? []);
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
      <TouchableOpacity
        style={styles.gridCard}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('Chat', { otherUserId: item.id, title: item.name })
        }
      >
        {item.photoUrls.length > 0 ? (
          <Image
            source={{ uri: item.photoUrls[0] }}
            style={styles.gridPhoto}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.gridPhoto, styles.gridPhotoPlaceholder]}>
            <Text style={styles.gridPhotoInitial}>{item.name.slice(0, 1)}</Text>
          </View>
        )}
        <View style={styles.gridInfo}>
          <Text style={styles.gridName} numberOfLines={1}>
            {item.name}{item.age ? `, ${item.age}` : ''}
          </Text>
          {!!item.location && (
            <Text style={styles.gridLocation} numberOfLines={1}>{item.location}</Text>
          )}
          <Text style={styles.gridMatched}>Matched {formatMatchDate(item.matchedAt)}</Text>
        </View>
      </TouchableOpacity>
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
        <View style={styles.convAvatar}>
          {item.otherAvatarUrl ? (
            <Image
              source={{ uri: item.otherAvatarUrl }}
              style={styles.convAvatarImg}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.convAvatarText}>
              {item.otherDisplayName.slice(0, 1).toUpperCase()}
            </Text>
          )}
        </View>
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
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>

      {/* Sub-tab pills */}
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
          <ActivityIndicator color="#0C5389" />
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
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0C5389" />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>🎉</Text>
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
          contentContainerStyle={conversations.length === 0 ? styles.emptyList : undefined}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0C5389" />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0C5389',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E8EEF2',
    gap: 6,
  },
  tabPillActive: {
    backgroundColor: '#0C5389',
  },
  tabPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A6070',
  },
  tabPillTextActive: {
    color: '#FDFDFD',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: '#FDFDFD',
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
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    backgroundColor: '#FDFDFD',
  },
  sortChipActive: {
    backgroundColor: '#189AA2',
    borderColor: '#189AA2',
  },
  sortChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A6070',
  },
  sortChipTextActive: {
    color: '#FDFDFD',
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
    borderRadius: 16,
    backgroundColor: '#FDFDFD',
    overflow: 'hidden',
    shadowColor: '#0C5389',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  gridPhoto: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    backgroundColor: '#D9E1E6',
  },
  gridPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridPhotoInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FDFDFD',
  },
  gridInfo: {
    padding: 10,
  },
  gridName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0C5389',
    marginBottom: 2,
  },
  gridLocation: {
    fontSize: 12,
    color: '#189AA2',
    marginBottom: 4,
  },
  gridMatched: {
    fontSize: 11,
    color: '#4A6070',
    opacity: 0.6,
  },
  emptyList: {
    flexGrow: 1,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FDFDFD',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEF2',
  },
  convAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#189AA2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  convAvatarImg: {
    width: 50,
    height: 50,
  },
  convAvatarText: {
    color: '#FDFDFD',
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
    color: '#0C5389',
  },
  convTime: {
    fontSize: 12,
    color: '#189AA2',
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
    color: '#4A6070',
    lineHeight: 19,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#0C5389',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#FDFDFD',
    fontSize: 11,
    fontWeight: '700',
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
});
