import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { fetchMatches, type Match } from '../lib/matches';

const COLORS = {
  blue: '#0C5389',
  teal: '#189AA2',
  white: '#FDFDFD',
  ink: '#0B1B2B',
  border: '#D9E1E6',
  text: '#2B3A4A',
  placeholder: '#D9E1E6',
};

export default function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (uid) load(uid);
    });
  }, []);

  async function load(uid: string) {
    setLoading(true);
    const data = await fetchMatches(uid);
    setMatches(data);
    setLoading(false);
  }

  function formatDate(iso: string) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
          <TouchableOpacity style={styles.matchRow} activeOpacity={0.7}>
            {item.photoUrls.length > 0 ? (
              <Image source={{ uri: item.photoUrls[0] }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]} />
            )}
            <View style={styles.info}>
              <Text style={styles.name}>
                {item.name}
                {item.age ? `, ${item.age}` : ''}
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
  info: {
    flex: 1,
  },
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
  messageIcon: {
    fontSize: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: COLORS.white,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
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
});
