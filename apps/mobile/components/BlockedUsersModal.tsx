import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBlockedProfiles, unblockUser, type BlockedProfile } from '../lib/blockReport';
import { getProfileImageUrls } from '../lib/storage';

type Props = {
  visible: boolean;
  userId: string;
  onClose: () => void;
};

export default function BlockedUsersModal({ visible, userId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [blocked, setBlocked] = useState<(BlockedProfile & { signedUrl: string | null })[]>([]);
  const [loading, setLoading] = useState(false);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    load();
  }, [visible]);

  async function load() {
    setLoading(true);
    const profiles = await getBlockedProfiles(userId);
    const withUrls = await Promise.all(
      profiles.map(async (p) => {
        let signedUrl: string | null = null;
        if (p.photoUrl) {
          const urls = await getProfileImageUrls(p.photoUrl);
          signedUrl = urls?.[0] ?? null;
        }
        return { ...p, signedUrl };
      })
    );
    setBlocked(withUrls);
    setLoading(false);
  }

  async function handleUnblock(profile: BlockedProfile) {
    Alert.alert(
      `Unblock ${profile.name}?`,
      'They may appear in your discover again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblocking(profile.id);
            await unblockUser(userId, profile.id);
            setBlocked((prev) => prev.filter((p) => p.id !== profile.id));
            setUnblocking(null);
          },
        },
      ]
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.done}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Blocked users</Text>
          <View style={{ width: 48 }} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#2D6A4F" />
          </View>
        ) : blocked.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>No blocked users</Text>
            <Text style={styles.emptySubtitle}>People you block will appear here.</Text>
          </View>
        ) : (
          <FlatList
            data={blocked}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <View style={styles.row}>
                {item.signedUrl ? (
                  <Image source={{ uri: item.signedUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitial}>{item.name[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                )}
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <TouchableOpacity
                  style={[styles.unblockBtn, unblocking === item.id && styles.unblockBtnDim]}
                  onPress={() => handleUnblock(item)}
                  disabled={unblocking === item.id}
                >
                  {unblocking === item.id ? (
                    <ActivityIndicator color="#2D6A4F" size="small" />
                  ) : (
                    <Text style={styles.unblockBtnText}>Unblock</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  done: { fontSize: 16, color: '#2D6A4F', fontWeight: '500' },
  title: { fontSize: 17, fontWeight: '700', color: '#1A2C24' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A2C24' },
  emptySubtitle: { fontSize: 14, color: '#717182' },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ECECF0' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: '#717182' },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1A2C24' },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#2D6A4F',
    minWidth: 80,
    alignItems: 'center',
  },
  unblockBtnDim: { opacity: 0.5 },
  unblockBtnText: { fontSize: 14, fontWeight: '600', color: '#2D6A4F' },
});
