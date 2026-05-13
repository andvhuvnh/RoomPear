import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
} from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts } from '../lib/typography';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatsStackParamList } from '../navigation/ChatsStack';
import { fetchMatches, type Match } from '../lib/matches';
import {
  fetchConversationSummaries,
  hideConversationFromList,
  type ConversationSummary,
} from '../lib/messaging';
import { supabase } from '../lib/supabase';
import BlockReportModal from '../components/BlockReportModal';
import PeerSafetyActionsModal, { type PeerSafetyStart } from '../components/PeerSafetyActionsModal';
import ThemedConfirmSheet from '../components/ThemedConfirmSheet';
type Props = NativeStackScreenProps<ChatsStackParamList, 'ChatsHome'>;
type SubTab = 'matched' | 'messages';
type SortBy = 'recent' | 'name';

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
  destructive: '#D4183D',
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
  const [messagesSearchQuery, setMessagesSearchQuery] = useState('');
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [reportPeer, setReportPeer] = useState<{ id: string; name: string } | null>(null);
  const [peerSafety, setPeerSafety] = useState<{
    otherUserId: string;
    otherName: string;
    start: PeerSafetyStart;
  } | null>(null);
  const [removeConvTarget, setRemoveConvTarget] = useState<ConversationSummary | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());
  /** Avoid full-screen spinner + list remount on every tab focus — keeps expo-image cache warm. */
  const initialLoadDoneRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) {
      setMyUserId(null);
      setLoading(false);
      initialLoadDoneRef.current = false;
      lastUserIdRef.current = null;
      return;
    }

    setMyUserId(uid);

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
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    void load();
  }, [load]);

  const sortedMatches = [...matches].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return b.matchedAt.localeCompare(a.matchedAt);
  });

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  const filteredConversations = useMemo(() => {
    const q = messagesSearchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.otherDisplayName.toLowerCase().includes(q) ||
        (c.lastMessagePreview ?? '').toLowerCase().includes(q)
    );
  }, [conversations, messagesSearchQuery]);

  const confirmRemoveConversation = useCallback((item: ConversationSummary) => {
    setRemoveError(null);
    setRemoveConvTarget(item);
  }, []);

  const runRemoveConversation = useCallback(async () => {
    if (!removeConvTarget) return;
    const { error } = await hideConversationFromList(removeConvTarget.conversationId);
    if (error) {
      setRemoveError(error.message);
      return;
    }
    setConversations((prev) => prev.filter((c) => c.conversationId !== removeConvTarget.conversationId));
    setRemoveConvTarget(null);
    setRemoveError(null);
  }, [removeConvTarget]);

  function renderMatchItem({ item }: { item: Match }) {
    return (
      <View style={styles.gridCard}>
        <View style={styles.gridCardClip}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('ProfileView', {
              userId: item.id,
              name: item.name,
              profileSource: 'chats',
            })
          }
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
              transition={200}
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
      </View>
    );
  }

  function renderConvItem({ item }: { item: ConversationSummary }) {
    const closeSwipe = () => swipeableRefs.current.get(item.conversationId)?.close();

    return (
      <Swipeable
        ref={(el) => {
          if (el) swipeableRefs.current.set(item.conversationId, el);
          else swipeableRefs.current.delete(item.conversationId);
        }}
        friction={2}
        overshootRight={false}
        renderRightActions={() => (
          <View style={styles.swipeRightCluster}>
            <RectButton
              style={styles.swipeCompactBtn}
              onPress={() => {
                closeSwipe();
                setPeerSafety({
                  otherUserId: item.otherUserId,
                  otherName: item.otherDisplayName,
                  start: 'confirmUnmatch',
                });
              }}
              accessibilityLabel="Unmatch"
            >
              <Ionicons name="heart-dislike-outline" size={20} color={C.destructive} />
              <Text style={styles.swipeCompactLabel} numberOfLines={1}>
                Unmatch
              </Text>
            </RectButton>
            <RectButton
              style={styles.swipeCompactBtn}
              onPress={() => {
                closeSwipe();
                setReportPeer({ id: item.otherUserId, name: item.otherDisplayName });
              }}
              accessibilityLabel="Report"
            >
              <Ionicons name="flag-outline" size={20} color={C.green} />
              <Text style={styles.swipeCompactLabel} numberOfLines={1}>
                Report
              </Text>
            </RectButton>
            <RectButton
              style={styles.swipeCompactBtn}
              onPress={() => {
                closeSwipe();
                setPeerSafety({
                  otherUserId: item.otherUserId,
                  otherName: item.otherDisplayName,
                  start: 'confirmBlock',
                });
              }}
              accessibilityLabel="Block"
            >
              <Ionicons name="ban-outline" size={20} color={C.destructive} />
              <Text style={styles.swipeCompactLabel} numberOfLines={1}>
                Block
              </Text>
            </RectButton>
            <RectButton
              style={styles.swipeCompactBtn}
              onPress={() => {
                closeSwipe();
                confirmRemoveConversation(item);
              }}
              accessibilityLabel="Remove conversation from list"
            >
              <Ionicons name="trash-outline" size={22} color={C.gray} />
              <Text style={[styles.swipeCompactLabel, { color: C.gray }]} numberOfLines={1}>
                Remove
              </Text>
            </RectButton>
          </View>
        )}
      >
        <TouchableOpacity
          style={styles.convRow}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate('Chat', {
              conversationId: item.conversationId,
              otherUserId: item.otherUserId,
              title: item.otherDisplayName,
            })
          }
        >
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('ProfileView', {
                userId: item.otherUserId,
                name: item.otherDisplayName,
                conversationId: item.conversationId,
                profileSource: 'chats',
              })
            }
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
                  transition={200}
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
      </Swipeable>
    );
  }

  return (
    <Background>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.heroTitle}>Chats</Text>
          <Text style={styles.heroTagline}>Matches and messages in one place</Text>
        </View>

        <View style={styles.tabSection}>
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
          <View style={styles.tabDivider} />
          {subTab === 'messages' && !loading && (
            <View style={styles.searchRow}>
              <View style={styles.searchField}>
                <Ionicons name="search-outline" size={18} color={C.gray} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search conversations"
                  placeholderTextColor={C.grayDim}
                  value={messagesSearchQuery}
                  onChangeText={setMessagesSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectionColor="#111111"
                  accessibilityLabel="Search conversations"
                />
                {messagesSearchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setMessagesSearchQuery('')}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel="Clear search"
                  >
                    <Ionicons name="close-circle-outline" size={22} color={C.grayDim} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        {!loading && subTab === 'matched' ? (
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
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Ionicons name="people-outline" size={44} color="#7A9080" style={{ marginBottom: 10 }} />
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
            data={filteredConversations}
            keyExtractor={(item) => item.conversationId}
            contentContainerStyle={
              conversations.length === 0 ? styles.gridContent : styles.msgListContent
            }
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              conversations.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="chatbubble-ellipses-outline" size={44} color="#7A9080" style={{ marginBottom: 10 }} />
                  <Text style={styles.emptyTitle}>No messages yet</Text>
                  <Text style={styles.emptyText}>
                    Match with someone and send them the first message!
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No results</Text>
                  <Text style={styles.emptyText}>Try a different name or keyword.</Text>
                </View>
              )
            }
            renderItem={renderConvItem}
          />
        )}
      </SafeAreaView>
      {myUserId && reportPeer && (
        <BlockReportModal
          visible
          reporterId={myUserId}
          reportedId={reportPeer.id}
          reportedName={reportPeer.name}
          onClose={() => setReportPeer(null)}
          onBlocked={() => {
            setReportPeer(null);
            void load(true);
          }}
        />
      )}
      {peerSafety && (
        <PeerSafetyActionsModal
          visible
          otherUserId={peerSafety.otherUserId}
          otherName={peerSafety.otherName}
          start={peerSafety.start}
          onClose={() => setPeerSafety(null)}
          onOpenReport={() => setReportPeer({ id: peerSafety.otherUserId, name: peerSafety.otherName })}
          onAfterUnmatchOrBlock={() => {
            setPeerSafety(null);
            void load(true);
          }}
        />
      )}
      <ThemedConfirmSheet
        visible={removeConvTarget !== null}
        title={removeError ? 'Could not remove' : 'Remove this conversation?'}
        message={
          removeError ??
          'It will be removed from your Messages list only. The other person still has the thread; messages are not deleted.'
        }
        confirmLabel={removeError ? 'OK' : 'Remove'}
        destructive={!removeError}
        singleAction={!!removeError}
        onConfirm={() => {
          if (removeError) {
            setRemoveConvTarget(null);
            setRemoveError(null);
            return;
          }
          void runRemoveConversation();
        }}
        onClose={() => {
          setRemoveConvTarget(null);
          setRemoveError(null);
        }}
      />
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
    fontFamily: fonts.extraBold,
    fontSize: 28,
    color: '#111111',
    letterSpacing: -0.5,
  },
  heroTagline: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: C.gray,
    marginTop: 2,
  },
  tabSection: {
    marginBottom: 4,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  tabDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  searchRow: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.10)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: C.text,
    paddingVertical: 0,
    minHeight: 22,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.10)',
    gap: 6,
  },
  tabPillActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  tabPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: C.gray,
  },
  tabPillTextActive: {
    color: '#FFFFFF',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: C.white,
    fontFamily: fonts.bold,
    fontSize: 11,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  gridCardClip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    overflow: 'hidden',
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
    marginBottom: 4,
  },
  gridMatched: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: C.grayDim,
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
  swipeRightCluster: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    marginBottom: 10,
    marginLeft: 6,
    gap: 6,
  },
  swipeCompactBtn: {
    width: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#FFFFFF',
  },
  swipeCompactLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: C.text,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 54,
  },
  convAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  convAvatarImg: {
    width: 52,
    height: 52,
  },
  convAvatarText: {
    fontFamily: fonts.bold,
    color: C.white,
    fontSize: 20,
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
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#111111',
  },
  convTime: {
    fontFamily: fonts.regular,
    fontSize: 12,
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
    fontFamily: fonts.regular,
    fontSize: 14,
    color: C.gray,
    lineHeight: 19,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontFamily: fonts.bold,
    color: C.white,
    fontSize: 11,
  },
  emptyCard: {
    alignSelf: 'center',
    maxWidth: 340,
    marginTop: 48,
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
});
