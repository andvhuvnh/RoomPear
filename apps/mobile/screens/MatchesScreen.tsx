import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { fetchMatches, type Match } from '../lib/matches';
import {
  ensureMatchConversation,
  sendMessage,
  type ChatMessageRow,
} from '../lib/messaging';

const COLORS = {
  blue: '#0C5389',
  teal: '#189AA2',
  white: '#FDFDFD',
  ink: '#0B1B2B',
  border: '#D9E1E6',
  text: '#2B3A4A',
  placeholder: '#D9E1E6',
};

type ActiveChat = {
  match: Match;
  conversationId: string | null;
  messages: ChatMessageRow[];
};

export default function MatchesScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    const data = await fetchMatches(uid);
    setMatches(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      supabase.auth.getSession().then(({ data }) => {
        const uid = data.session?.user.id;
        if (!uid || cancelled) return;
        setUserId(uid);
        load(uid);
      });
      return () => { cancelled = true; };
    }, [load])
  );

  async function openChat(match: Match) {
    setActiveChat({ match, conversationId: null, messages: [] });
  }

  function closeChat() {
    setActiveChat(null);
    setDraft('');
    if (userId) load(userId);
  }

  async function handleSend() {
    if (!draft.trim() || sending || !activeChat || !userId) return;
    setSending(true);

    let convId = activeChat.conversationId;

    // Create conversation on first message
    if (!convId) {
      const { data: newId, error } = await ensureMatchConversation(activeChat.match.id);
      if (error || !newId) {
        setSending(false);
        return;
      }
      convId = newId;
      setActiveChat((prev) => prev ? { ...prev, conversationId: convId } : prev);
    }

    const { data, error } = await sendMessage(convId!, draft);
    setSending(false);
    if (error || !data) return;

    setDraft('');
    setActiveChat((prev) =>
      prev ? { ...prev, messages: [...prev.messages, data] } : prev
    );

    // Move match to Messages — reload matches list in background
    load(userId);
  }

  function formatDate(iso: string) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Inline chat view
  if (activeChat) {
    return (
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Chat header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={closeChat} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.chatHeaderName}>{activeChat.match.name}</Text>
        </View>

        {/* Messages */}
        <FlatList
          data={activeChat.messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>
                Say hi to {activeChat.match.name}!
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === userId;
            return (
              <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                    {item.body}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {/* Input */}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.blue} />
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>💚</Text>
        <Text style={styles.emptyTitle}>No matches yet</Text>
        <Text style={styles.emptyText}>
          When you and someone both like each other, they'll show up here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Matches</Text>
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.matchRow}
            activeOpacity={0.7}
            onPress={() => openChat(item)}
          >
            {item.photoUrls.length > 0 ? (
              <Image source={{ uri: item.photoUrls[0] }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]} />
            )}
            <View style={styles.info}>
              <Text style={styles.name}>
                {item.name}{item.age ? `, ${item.age}` : ''}
              </Text>
              {item.location ? (
                <Text style={styles.location}>{item.location}</Text>
              ) : null}
              <Text style={styles.matchedAt}>Matched {formatDate(item.matchedAt)}</Text>
            </View>
            <View style={styles.messageButton}>
              <Text style={styles.messageIcon}>💬</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingTop: 60,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.ink,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.placeholder,
  },
  info: { flex: 1 },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.ink,
  },
  location: {
    fontSize: 13,
    color: COLORS.teal,
    marginTop: 2,
  },
  matchedAt: {
    fontSize: 12,
    color: COLORS.text,
    opacity: 0.5,
    marginTop: 4,
  },
  messageButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F0F4F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageIcon: { fontSize: 20 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: COLORS.white,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Chat styles
  chatContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: { marginRight: 12, padding: 4 },
  backText: { fontSize: 24, color: COLORS.blue },
  chatHeaderName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.ink,
  },
  messageList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyChatText: {
    fontSize: 15,
    color: COLORS.text,
    opacity: 0.5,
  },
  bubbleRow: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: COLORS.blue,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: '#F0F4F8',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    color: COLORS.ink,
    lineHeight: 21,
  },
  bubbleTextMine: { color: '#fff' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F4F8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.ink,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  sendBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
