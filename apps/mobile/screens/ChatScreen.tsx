import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatsStackParamList } from '../navigation/ChatsStack';
import { supabase } from '../lib/supabase';
import {
  fetchMessages,
  markConversationRead,
  sendMessage,
  ensureMatchConversation,
  type ChatMessageRow,
} from '../lib/messaging';

type Props = NativeStackScreenProps<ChatsStackParamList, 'Chat'>;

export default function ChatScreen({ navigation, route }: Props) {
  const { conversationId: initialConversationId, otherUserId, title } = route.params;
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!initialConversationId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessageRow>>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

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
      // Mark read when the thread is opened.
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
            // If we receive a message while the chat is open, treat it as read.
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

  const onSend = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);

    // If no conversation yet, create it now (first message)
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0C5389" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: true })
        }
        renderItem={({ item }) => {
          const mine = myUserId != null && item.sender_id === myUserId;
          return (
            <View
              style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
            >
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                  {item.body}
                </Text>
                <Text style={[styles.time, mine && styles.timeMine]}>
                  {new Date(item.created_at).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor="#889"
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E8EEF2',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8EEF2',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexGrow: 1,
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
    backgroundColor: '#189AA2',
  },
  bubbleTheirs: {
    backgroundColor: '#FDFDFD',
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#0C5389',
  },
  bubbleTextMine: {
    color: '#FDFDFD',
  },
  time: {
    marginTop: 4,
    fontSize: 11,
    color: '#189AA2',
    alignSelf: 'flex-end',
  },
  timeMine: {
    color: 'rgba(253,253,253,0.85)',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#FDFDFD',
    borderTopWidth: 1,
    borderTopColor: '#D9E1E6',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0C5389',
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: '#0C5389',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    color: '#FDFDFD',
    fontWeight: '600',
    fontSize: 16,
  },
});
