import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MessagesStackParamList } from '../navigation/MessagesStack';
import {
  fetchConversationSummaries,
  type ConversationSummary,
} from '../lib/messaging';

type Props = NativeStackScreenProps<MessagesStackParamList, 'ConversationList'>;

function formatTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MessagesListScreen({ navigation }: Props) {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    if (!hasLoadedOnce.current) setLoading(true);
    const { data, error } = await fetchConversationSummaries();
    if (error) {
      setError(error.message);
      setItems([]);
    } else {
      setItems(data);
    }
    hasLoadedOnce.current = true;
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0C5389" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.conversationId}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0C5389" />
        }
        contentContainerStyle={items.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No conversations yet. When you have chats, they will appear here! Message someone
            to get started :)
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              navigation.navigate('Chat', {
                conversationId: item.conversationId,
                title: item.otherDisplayName,
              })
            }
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              {item.otherAvatarUrl ? (
                <Image
                  source={{ uri: item.otherAvatarUrl }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatarText}>
                  {item.otherDisplayName.slice(0, 1).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.otherDisplayName}
                </Text>
                <Text style={styles.time}>
                  {formatTime(item.lastMessageAt ?? item.conversationCreatedAt)}
                </Text>
              </View>
              <Text style={styles.preview} numberOfLines={2}>
                {item.lastMessagePreview ?? 'No messages yet'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
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
  banner: {
    backgroundColor: '#fde8e8',
    padding: 10,
  },
  bannerText: {
    color: '#a30',
    fontSize: 14,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FDFDFD',
    borderBottomWidth: 1,
    borderBottomColor: '#D9E1E6',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#189AA2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    color: '#FDFDFD',
    fontSize: 20,
    fontWeight: '700',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#0C5389',
  },
  time: {
    fontSize: 13,
    color: '#189AA2',
  },
  preview: {
    marginTop: 4,
    fontSize: 15,
    color: '#556',
    lineHeight: 20,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 15,
    color: '#189AA2',
    textAlign: 'center',
    lineHeight: 22,
  },
});
