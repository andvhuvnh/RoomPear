import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { fetchDiscoverProfiles, recordSwipe, type DiscoverProfile } from '../lib/discover';
import PublicProfileCard from '../components/PublicProfileCard';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

const COLORS = {
  blue: '#0C5389',
  teal: '#189AA2',
  green: '#46BD7F',
  white: '#FDFDFD',
  ink: '#0B1B2B',
  border: '#D9E1E6',
  text: '#2B3A4A',
};

export default function DiscoverScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchName, setMatchName] = useState<string | null>(null);
  const [expandedProfile, setExpandedProfile] = useState<DiscoverProfile | null>(null);
  const [actionDisabled, setActionDisabled] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      if (uid) loadProfiles(uid);
    });
  }, []);

  async function loadProfiles(uid: string) {
    setLoading(true);
    const data = await fetchDiscoverProfiles(uid);
    setProfiles(data);
    setCurrentIndex(0);
    setLoading(false);
  }

  async function handleAction(direction: 'like' | 'pass') {
    if (actionDisabled) return;
    setActionDisabled(true);

    // Fade out current card
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(async () => {
      const current = profiles[currentIndex];
      if (current && userId) {
        const { isMatch } = await recordSwipe(userId, current.id, direction);
        if (isMatch) setMatchName(current.name);
      }

      setCurrentIndex((prev) => prev + 1);

      // Fade in next card
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setActionDisabled(false));
    });
  }

  const currentProfile = profiles[currentIndex];
  const hasMore = currentIndex < profiles.length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Finding roommates...</Text>
      </View>
    );
  }

  if (!hasMore) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>You're all caught up</Text>
        <Text style={styles.emptyText}>No more profiles right now.{'\n'}Check back later!</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => userId && loadProfiles(userId)}
        >
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Discover</Text>

      <View style={styles.cardArea}>
        <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => setExpandedProfile(currentProfile)}
          >
            <PublicProfileCard
              imageUrls={currentProfile.photoUrls}
              name={currentProfile.name}
              age={currentProfile.age}
              location={currentProfile.location}
              bio={currentProfile.bio}
              hobbies={currentProfile.hobbies}
            />
          </TouchableOpacity>
          <Text style={styles.tapHint}>Tap card to view full profile</Text>
        </Animated.View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.passButton, actionDisabled && styles.buttonDisabled]}
          onPress={() => handleAction('pass')}
          disabled={actionDisabled}
        >
          <Text style={styles.passIcon}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.likeButton, actionDisabled && styles.buttonDisabled]}
          onPress={() => handleAction('like')}
          disabled={actionDisabled}
        >
          <Text style={styles.likeIcon}>♥</Text>
        </TouchableOpacity>
      </View>

      {/* Full profile modal */}
      <Modal visible={!!expandedProfile} animationType="slide" statusBarTranslucent>
        {expandedProfile && (
          <View style={styles.profileModal}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Photo gallery */}
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.photoScroll}
              >
                {expandedProfile.photoUrls.map((url, i) => (
                  <Image
                    key={i}
                    source={{ uri: url }}
                    style={[styles.fullPhoto, { width: SCREEN_WIDTH }]}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>

              {/* Info */}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {expandedProfile.name}
                  {expandedProfile.age ? `, ${expandedProfile.age}` : ''}
                </Text>
                {expandedProfile.location ? (
                  <Text style={styles.profileLocation}>{expandedProfile.location}</Text>
                ) : null}
                {expandedProfile.bio ? (
                  <Text style={styles.profileBio}>{expandedProfile.bio}</Text>
                ) : null}
                {expandedProfile.hobbies && expandedProfile.hobbies.length > 0 && (
                  <>
                    <Text style={styles.hobbiesLabel}>Interests</Text>
                    <View style={styles.hobbiesRow}>
                      {expandedProfile.hobbies.map((h, i) => (
                        <View key={i} style={styles.hobbyChip}>
                          <Text style={styles.hobbyChipText}>{h}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </ScrollView>

            {/* Bottom actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.passButton}
                onPress={() => {
                  setExpandedProfile(null);
                  handleAction('pass');
                }}
              >
                <Text style={styles.passIcon}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.likeButton}
                onPress={() => {
                  setExpandedProfile(null);
                  handleAction('like');
                }}
              >
                <Text style={styles.likeIcon}>♥</Text>
              </TouchableOpacity>
            </View>

            {/* Close */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setExpandedProfile(null)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {/* Match modal */}
      <Modal visible={!!matchName} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.matchCard}>
            <Text style={styles.matchEmoji}>🎉</Text>
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Text style={styles.matchSub}>You and {matchName} both liked each other.</Text>
            <TouchableOpacity style={styles.matchButton} onPress={() => setMatchName(null)}>
              <Text style={styles.matchButtonText}>Keep Going</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: 12,
  },
  cardArea: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapHint: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
    color: COLORS.text,
    opacity: 0.45,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
    paddingVertical: 24,
    paddingBottom: 36,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
    paddingVertical: 20,
    paddingBottom: 36,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  passButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  passIcon: {
    fontSize: 26,
    color: '#E53935',
  },
  likeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.green,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  likeIcon: {
    fontSize: 26,
    color: COLORS.green,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: COLORS.white,
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
  refreshButton: {
    marginTop: 24,
    backgroundColor: COLORS.blue,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  profileModal: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  photoScroll: {
    height: SCREEN_HEIGHT * 0.55,
  },
  fullPhoto: {
    height: SCREEN_HEIGHT * 0.55,
  },
  profileInfo: {
    padding: 24,
    paddingBottom: 16,
  },
  profileName: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.ink,
  },
  profileLocation: {
    fontSize: 16,
    color: COLORS.teal,
    fontWeight: '500',
    marginTop: 4,
  },
  profileBio: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
    marginTop: 16,
  },
  hobbiesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  hobbiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hobbyChip: {
    backgroundColor: 'rgba(24,154,162,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  hobbyChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.teal,
  },
  closeButton: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchCard: {
    backgroundColor: COLORS.white,
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
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.ink,
    marginBottom: 8,
  },
  matchSub: {
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  matchButton: {
    backgroundColor: COLORS.blue,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
  },
  matchButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
