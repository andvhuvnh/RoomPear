import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Keyboard,
  type KeyboardEvent,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatsStackParamList } from '../navigation/ChatsStack';
import { supabase } from '../lib/supabase';
import {
  fetchMessages,
  markConversationRead,
  sendMessage,
  ensureMatchConversation,
  clearConversationHiddenFromList,
  fetchOtherParticipantUserId,
  type ChatMessageRow,
} from '../lib/messaging';
import PeerSafetyActionsModal, { type PeerSafetyStart } from '../components/PeerSafetyActionsModal';
import ThemedConfirmSheet from '../components/ThemedConfirmSheet';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CHATS_CARD,
  CHATS_GREEN_BORDER,
} from '../theme/chatsAmbient';
import { fonts } from '../lib/typography';
import { ChatStyleTopBar } from '../components/ChatStyleTopBar';
import PearLoader from '../components/PearLoader';
import BlockReportModal from '../components/BlockReportModal';

type Props = NativeStackScreenProps<ChatsStackParamList, 'Chat'>;

/** Extra space between the composer and the top of the keyboard (iOS). */
const KEYBOARD_TOP_GAP = 10;

const C = {
  text: '#111111',
  gray: '#717182',
  mineBubble: '#111111',
  mineTextOnBubble: '#FFFFFF',
  white: '#FFFFFF',
  surface: CHATS_CARD,
  surfaceBorder: CHATS_GREEN_BORDER,
  cta: '#111111',
};

type ChatListItem =
  | { kind: 'date'; id: string; label: string }
  | { kind: 'msg'; id: string; msg: ChatMessageRow };

function isSameLocalCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Today / yesterday / short date for older days (year if not current year). */
function formatDateSeparatorLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (isSameLocalCalendarDay(d, today)) return 'Today';

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameLocalCalendarDay(d, yesterday)) return 'Yesterday';

  const sameYear = d.getFullYear() === today.getFullYear();
  if (sameYear) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildChatListItems(rows: ChatMessageRow[]): ChatListItem[] {
  const out: ChatListItem[] = [];
  let prevDayKey: string | null = null;

  for (const msg of rows) {
    const dayKey = localDayKey(msg.created_at);
    if (dayKey !== prevDayKey) {
      out.push({
        kind: 'date',
        id: `date-${dayKey}`,
        label: formatDateSeparatorLabel(msg.created_at),
      });
      prevDayKey = dayKey;
    }
    out.push({ kind: 'msg', id: msg.id, msg });
  }
  return out;
}

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

export default function ChatScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { conversationId: initialConversationId, otherUserId: routeOtherUserId, title } =
    route.params;
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | undefined>(routeOtherUserId);
  const [loading, setLoading] = useState(!!initialConversationId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [peerSafetyOpen, setPeerSafetyOpen] = useState(false);
  const [peerSafetyStart, setPeerSafetyStart] = useState<PeerSafetyStart>('main');
  const [waitPeerSheet, setWaitPeerSheet] = useState(false);
  /** Bottom inset for keyboard — avoids KeyboardAvoidingView fighting FlatList (jitter). */
  const [keyboardBottom, setKeyboardBottom] = useState(0);
  const listRef = useRef<FlatList<ChatListItem>>(null);
  const messageCountRef = useRef(0);

  /** Space for floating top bar (safe area + row + padding). */
  const topPad = insets.top + 56 + 12;

  const appendUnique = useCallback((row: ChatMessageRow) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === row.id)) return prev;
      return [...prev, row];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) setMyUserId(user.id);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!conversationId || otherUserId) return;
    let cancelled = false;
    void (async () => {
      const { userId, error } = await fetchOtherParticipantUserId(conversationId);
      if (cancelled) return;
      if (error) {
        console.warn('fetchOtherParticipantUserId', error.message);
        return;
      }
      if (userId) setOtherUserId(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, otherUserId]);

  useEffect(() => {
    let cancelled = false;

    if (!conversationId) return;

    (async () => {
      const { data, error } = await fetchMessages(conversationId);
      if (cancelled) return;
      if (error) {
        console.warn('fetchMessages', error.message);
        setMessages([]);
      } else {
        setMessages(data);
      }
      markConversationRead(conversationId).then(({ error: rErr }) => {
        if (rErr) console.warn('markConversationRead', rErr.message);
      });
      setLoading(false);
    })();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          if (row?.conversation_id === conversationId) {
            appendUnique(row);
            if (myUserId && row.sender_id && row.sender_id !== myUserId) {
              markConversationRead(conversationId).then(({ error: rErr }) => {
                if (rErr) console.warn('markConversationRead', rErr.message);
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId, appendUnique, myUserId]);

  const openSafetyMenu = useCallback(() => {
    if (!otherUserId) {
      setWaitPeerSheet(true);
      return;
    }
    setPeerSafetyStart('main');
    setPeerSafetyOpen(true);
  }, [otherUserId]);

  useEffect(() => {
    if (!conversationId) return;
    clearConversationHiddenFromList(conversationId).then(({ error }) => {
      if (error) console.warn('clearConversationHiddenFromList', error.message);
    });
  }, [conversationId]);

  // iOS: window doesn’t resize for the keyboard — pad the composer by keyboard height.
  // Android: rely on adjustResize + flex layout; extra padding here doubles the shift and jitters.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const onShow = (e: KeyboardEvent) => setKeyboardBottom(e.endCoordinates.height);
    const onHide = () => setKeyboardBottom(0);

    const subShow = Keyboard.addListener('keyboardDidShow', onShow);
    const subHide = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  // Scroll only when the message list changes — not on every layout/content-size change
  // (keyboard + KeyboardAvoidingView resize was retriggering scrollToEnd and causing jitter).
  useEffect(() => {
    if (messages.length === 0) {
      messageCountRef.current = 0;
      return;
    }
    if (messages.length === messageCountRef.current) return;
    messageCountRef.current = messages.length;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: messages.length > 1 });
    });
  }, [messages.length]);

  const listItems = useMemo(() => buildChatListItems(messages), [messages]);

  const onSend = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);

    let convId = conversationId;
    if (!convId && otherUserId) {
      const { data: newConvId, error: convErr } = await ensureMatchConversation(otherUserId);
      if (convErr || !newConvId) {
        console.warn('ensureMatchConversation', convErr?.message);
        setSending(false);
        return;
      }
      convId = newConvId;
      setConversationId(convId);
    }

    if (!convId) {
      setSending(false);
      return;
    }

    const { data, error } = await sendMessage(convId, draft);
    setSending(false);
    if (error) {
      console.warn('sendMessage', error.message);
      return;
    }
    setDraft('');
    if (data) appendUnique(data);
  };

  if (loading) {
    return (
      <Background>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <ChatStyleTopBar
            title={title}
            onBack={() => navigation.goBack()}
            topInset={insets.top}
            backAccessibilityLabel="Back to chats"
            onMenu={openSafetyMenu}
          />
        </View>
        <View style={[styles.centered, { paddingTop: insets.top + 56 }]}>
          <PearLoader size={64} />
        </View>
      </Background>
    );
  }

  const composerBottomPad =
    Platform.OS === 'ios'
      ? keyboardBottom > 0
        ? keyboardBottom + KEYBOARD_TOP_GAP
        : Math.max(insets.bottom, 10)
      : Math.max(insets.bottom, 10);

  return (
    <Background>
      <View style={styles.root}>
        <View style={styles.flex}>
          <FlatList
            ref={listRef}
            data={listItems}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={[
              styles.listContent,
              { paddingTop: topPad },
            ]}
            renderItem={({ item }) => {
              if (item.kind === 'date') {
                return (
                  <View style={styles.dateSeparatorRow} accessibilityRole="header">
                    <View style={styles.dateSeparatorPill}>
                      <Text style={styles.dateSeparatorText}>{item.label}</Text>
                    </View>
                  </View>
                );
              }

              const m = item.msg;
              const mine = myUserId != null && m.sender_id === myUserId;
              return (
                <View
                  style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
                >
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.body}</Text>
                    <Text style={[styles.time, mine && styles.timeMine]}>
                      {new Date(m.created_at).toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <ChatStyleTopBar
              title={title}
              onBack={() => navigation.goBack()}
              topInset={insets.top}
              backAccessibilityLabel="Back to chats"
              onMenu={openSafetyMenu}
            />
          </View>
        </View>

        <View style={[styles.composer, { paddingBottom: composerBottomPad }]}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor={C.gray}
            multiline
            maxLength={4000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
            onPress={onSend}
            disabled={!draft.trim() || sending}
            accessibilityLabel="Send message"
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
      {myUserId && otherUserId && (
        <BlockReportModal
          visible={reportOpen}
          reporterId={myUserId}
          reportedId={otherUserId}
          reportedName={title}
          onClose={() => setReportOpen(false)}
          onBlocked={() => {
            setReportOpen(false);
            navigation.goBack();
          }}
        />
      )}
      {otherUserId && (
        <PeerSafetyActionsModal
          visible={peerSafetyOpen}
          otherUserId={otherUserId}
          otherName={title}
          start={peerSafetyStart}
          onClose={() => setPeerSafetyOpen(false)}
          onOpenReport={() => {
            setPeerSafetyOpen(false);
            setReportOpen(true);
          }}
          onAfterUnmatchOrBlock={() => {
            setPeerSafetyOpen(false);
            navigation.goBack();
          }}
        />
      )}
      <ThemedConfirmSheet
        visible={waitPeerSheet}
        title="One moment"
        message="Still loading this chat. Try again in a second."
        confirmLabel="OK"
        singleAction
        onConfirm={() => setWaitPeerSheet(false)}
        onClose={() => setWaitPeerSheet(false)}
      />
    </Background>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexGrow: 1,
  },
  dateSeparatorRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 4,
    marginBottom: 6,
  },
  dateSeparatorPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(45, 106, 79, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CHATS_GREEN_BORDER,
  },
  dateSeparatorText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: C.gray,
    letterSpacing: 0.3,
  },
  bubbleRow: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: C.mineBubble,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
  },
  bubbleTheirs: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  bubbleText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    color: C.text,
  },
  bubbleTextMine: {
    color: C.mineTextOnBubble,
  },
  time: {
    marginTop: 4,
    fontSize: 11,
    color: C.gray,
    alignSelf: 'flex-end',
  },
  timeMine: {
    color: 'rgba(250, 251, 250, 0.82)',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: CHATS_CARD,
    borderTopWidth: 1,
    borderTopColor: CHATS_GREEN_BORDER,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: CHATS_GREEN_BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: C.text,
    backgroundColor: C.surface,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: C.cta,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    fontFamily: fonts.semiBold,
    color: C.white,
    fontSize: 16,
  },
});
