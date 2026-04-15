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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { supabase } from '../lib/supabase';
import { fetchDiscoverProfiles, recordSwipe, type DiscoverProfile } from '../lib/discover';
import { getProfileImageUrls } from '../lib/storage';
import { profilePhotoPathsFromRow } from '../lib/profileDisplay';
import SwipeCard from '../components/SwipeCard';
import type { MainTabParamList } from '../navigation/MainTabNavigator';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Action = 'like' | 'pass' | 'top_pick';

type MatchData = {
  name: string;
  otherUserId: string;
  theirPhotoUrl: string | null;
  myPhotoUrl: string | null;
  sharedInterests: string[];
};

export default function DiscoverScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [userId, setUserId] = useState<string | null>(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState<string | null>(null);
  const [myHobbies, setMyHobbies] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actionDisabled, setActionDisabled] = useState(false);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [expandedProfile, setExpandedProfile] = useState<DiscoverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Animation values for the front card
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      if (uid) {
        loadProfiles(uid);
        // Fetch my own photo + interests for the match modal
        const { data: me } = await supabase
          .from('profiles')
          .select('profile_photo_url, hobbies')
          .eq('id', uid)
          .single();
        if (me?.profile_photo_url) {
          const paths = profilePhotoPathsFromRow(me.profile_photo_url);
          if (paths[0]) {
            const urls = await getProfileImageUrls(me.profile_photo_url);
            setMyPhotoUrl(urls?.[0] ?? null);
          }
        }
        // Use preferences.interests (flattened) if available, fall back to profiles.hobbies
        const { data: myPrefs } = await supabase
          .from('preferences')
          .select('interests')
          .eq('user_id', uid)
          .single();
        const interestChips = Object.values(myPrefs?.interests ?? {}).flat() as string[];
        setMyHobbies(interestChips.length > 0 ? interestChips : (Array.isArray(me?.hobbies) ? me.hobbies : []));
      }
    });
  }, []);

  async function loadProfiles(uid: string) {
    setLoading(true);
    const data = await fetchDiscoverProfiles(uid);
    setProfiles(data);
    setCurrentIndex(0);
    translateX.setValue(0);
    translateY.setValue(0);
    cardOpacity.setValue(1);
    setLoading(false);
  }

  // Animate the card flying off in the given direction, then advance to next
  function animateOut(direction: Action, onDone: () => void) {
    const toX =
      direction === 'like' ? SCREEN_WIDTH * 1.5
      : direction === 'pass' ? -SCREEN_WIDTH * 1.5
      : 0;
    const toY = direction === 'top_pick' ? -SCREEN_HEIGHT : 0;

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: toX,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: toY,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Reset values before content changes so new card appears at origin
      translateX.setValue(0);
      translateY.setValue(0);
      cardOpacity.setValue(1);
      onDone();
    });
  }

  async function handleAction(direction: Action) {
    if (actionDisabled) return;
    setActionDisabled(true);

    const current = profiles[currentIndex];

    animateOut(direction, async () => {
      if (current && userId) {
        const { isMatch } = await recordSwipe(userId, current.id, direction);
        if (isMatch) {
          const sharedInterests = myHobbies.filter((h) =>
            (current.hobbies ?? []).includes(h)
          );
          setMatchData({
            name: current.name,
            otherUserId: current.id,
            theirPhotoUrl: current.photoUrls?.[0] ?? null,
            myPhotoUrl,
            sharedInterests,
          });
        }
      }
      setCurrentIndex((prev) => prev + 1);
      setActionDisabled(false);
    });
  }

  function handleUndo() {
    if (actionDisabled || currentIndex === 0) return;
    setActionDisabled(true);
    cardOpacity.setValue(0);
    setCurrentIndex((prev) => prev - 1);
    Animated.timing(cardOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setActionDisabled(false));
  }

  const currentProfile = profiles[currentIndex];
  const nextProfile = profiles[currentIndex + 1];
  const remaining = profiles.length - currentIndex;

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Finding roommates…</Text>
      </View>
    );
  }

  if (!currentProfile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>You're all caught up</Text>
        <Text style={styles.emptyText}>No more profiles right now.{'\n'}Check back later!</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => userId && loadProfiles(userId)}
        >
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <Text style={styles.headerCount}>
          {remaining} {remaining === 1 ? 'person' : 'people'} nearby
        </Text>
      </View>

      {/* ── Card stack ── */}
      <View style={styles.cardArea}>
        {/* Back card — static, slightly smaller */}
        {nextProfile && (
          <View style={styles.backCardWrap} pointerEvents="none">
            <SwipeCard profile={nextProfile} onPress={() => {}} />
          </View>
        )}

        {/* Front card — animated */}
        <Animated.View
          style={[
            styles.frontCardWrap,
            {
              transform: [{ translateX }, { translateY }],
              opacity: cardOpacity,
            },
          ]}
        >
          <SwipeCard
            profile={currentProfile}
            onPress={() => setExpandedProfile(currentProfile)}
          />
        </Animated.View>
      </View>

      {/* ── Action buttons ── */}
      <View style={styles.actions}>
        {/* Undo */}
        <TouchableOpacity
          style={[styles.btn, styles.btnUndo, (actionDisabled || currentIndex === 0) && styles.btnDisabled]}
          onPress={handleUndo}
          disabled={actionDisabled || currentIndex === 0}
        >
          <Text style={[styles.btnIcon, styles.btnIconUndo]}>↩</Text>
        </TouchableOpacity>

        {/* Pass */}
        <TouchableOpacity
          style={[styles.btn, styles.btnPass, actionDisabled && styles.btnDisabled]}
          onPress={() => handleAction('pass')}
          disabled={actionDisabled}
        >
          <Text style={[styles.btnIcon, styles.btnIconPass]}>✕</Text>
        </TouchableOpacity>

        {/* Top Pick */}
        <TouchableOpacity
          style={[styles.btn, styles.btnTop, actionDisabled && styles.btnDisabled]}
          onPress={() => handleAction('top_pick')}
          disabled={actionDisabled}
        >
          <Text style={[styles.btnIcon, styles.btnIconTop]}>★</Text>
        </TouchableOpacity>

        {/* Like */}
        <TouchableOpacity
          style={[styles.btn, styles.btnLike, actionDisabled && styles.btnDisabled]}
          onPress={() => handleAction('like')}
          disabled={actionDisabled}
        >
          <Text style={[styles.btnIcon, styles.btnIconLike]}>♥</Text>
        </TouchableOpacity>
      </View>

      {/* ── Full profile modal ── */}
      <Modal visible={!!expandedProfile} animationType="slide" statusBarTranslucent>
        {expandedProfile && (
          <View style={styles.profileModal}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={{ height: SCREEN_HEIGHT * 0.55 }}
              >
                {expandedProfile.photoUrls.map((url, i) => (
                  <Image
                    key={i}
                    source={{ uri: url }}
                    style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.55 }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>

              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {expandedProfile.name}
                  {expandedProfile.age ? `, ${expandedProfile.age}` : ''}
                </Text>
                {expandedProfile.location ? (
                  <Text style={styles.profileLocation}>📍 {expandedProfile.location}</Text>
                ) : null}
                {expandedProfile.bio ? (
                  <Text style={styles.profileBio}>{expandedProfile.bio}</Text>
                ) : null}
                {expandedProfile.hobbies && expandedProfile.hobbies.length > 0 && (
                  <>
                    <Text style={styles.profileSectionLabel}>Interests</Text>
                    <View style={styles.profileChips}>
                      {expandedProfile.hobbies.map((h, i) => (
                        <View key={i} style={styles.profileChip}>
                          <Text style={styles.profileChipText}>{h}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnPass]}
                onPress={() => { setExpandedProfile(null); handleAction('pass'); }}
              >
                <Text style={[styles.btnIcon, styles.btnIconPass]}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnTop]}
                onPress={() => { setExpandedProfile(null); handleAction('top_pick'); }}
              >
                <Text style={[styles.btnIcon, styles.btnIconTop]}>★</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnLike]}
                onPress={() => { setExpandedProfile(null); handleAction('like'); }}
              >
                <Text style={[styles.btnIcon, styles.btnIconLike]}>♥</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setExpandedProfile(null)}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {/* ── Match modal ── */}
      <Modal visible={!!matchData} transparent animationType="fade">
        <View style={styles.matchOverlay}>
          <View style={styles.matchCard}>
            <Text style={styles.matchEmoji}>🍐</Text>
            <Text style={styles.matchTitle}>It's a Match!</Text>

            {/* Avatars */}
            <View style={styles.matchAvatars}>
              <View style={styles.matchAvatarWrap}>
                {matchData?.myPhotoUrl ? (
                  <Image source={{ uri: matchData.myPhotoUrl }} style={styles.matchAvatar} />
                ) : (
                  <View style={[styles.matchAvatar, styles.matchAvatarPlaceholder]} />
                )}
              </View>
              <View style={[styles.matchAvatarWrap, styles.matchAvatarRight]}>
                {matchData?.theirPhotoUrl ? (
                  <Image source={{ uri: matchData.theirPhotoUrl }} style={styles.matchAvatar} />
                ) : (
                  <View style={[styles.matchAvatar, styles.matchAvatarPlaceholder]} />
                )}
              </View>
            </View>

            <Text style={styles.matchSub}>
              You and {matchData?.name} both want to be roommates!
            </Text>

            {/* Shared interests */}
            {matchData && matchData.sharedInterests.length > 0 && (
              <View style={styles.matchInterestsWrap}>
                <Text style={styles.matchInterestsLabel}>You both like</Text>
                <View style={styles.matchChips}>
                  {matchData.sharedInterests.slice(0, 3).map((interest) => (
                    <View key={interest} style={styles.matchChip}>
                      <Text style={styles.matchChipText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.matchBtn}
              onPress={() => {
                setMatchData(null);
                navigation.navigate('Chats', {
                  screen: 'Chat',
                  params: { otherUserId: matchData!.otherUserId, title: matchData!.name },
                } as any);
              }}
            >
              <Text style={styles.matchBtnText}>Send Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.matchBtnSecondary}
              onPress={() => setMatchData(null)}
            >
              <Text style={styles.matchBtnSecondaryText}>Keep Swiping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 32,
    backgroundColor: '#F4F7F9',
  },
  emptyTitle: {
    fontSize: 22,
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
  refreshBtn: {
    marginTop: 24,
    backgroundColor: '#0C5389',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
  },
  refreshBtnText: {
    color: '#FDFDFD',
    fontWeight: '700',
    fontSize: 15,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0C5389',
  },
  headerCount: {
    fontSize: 13,
    color: '#189AA2',
    fontWeight: '600',
  },

  // Card area
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backCardWrap: {
    position: 'absolute',
    transform: [{ scale: 0.96 }, { translateY: 10 }],
    opacity: 0.7,
  },
  frontCardWrap: {
    position: 'absolute',
  },

  // Action buttons
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
    paddingBottom: 28,
    backgroundColor: '#F4F7F9',
  },
  btn: {
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDFDFD',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.35 },
  btnUndo: { width: 52, height: 52, borderWidth: 1.5, borderColor: '#C0CDD6' },
  btnPass: { width: 64, height: 64, borderWidth: 2, borderColor: '#E53935' },
  btnTop:  { width: 64, height: 64, borderWidth: 2, borderColor: '#F59E0B' },
  btnLike: { width: 72, height: 72, borderWidth: 2, borderColor: '#189AA2' },
  btnIcon: { fontSize: 24 },
  btnIconUndo: { color: '#9AA', fontSize: 20 },
  btnIconPass: { color: '#E53935' },
  btnIconTop:  { color: '#F59E0B' },
  btnIconLike: { color: '#189AA2', fontSize: 26 },

  // Full profile modal
  profileModal: {
    flex: 1,
    backgroundColor: '#FDFDFD',
  },
  profileInfo: {
    padding: 24,
    paddingBottom: 16,
  },
  profileName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0C5389',
  },
  profileLocation: {
    fontSize: 15,
    color: '#189AA2',
    fontWeight: '500',
    marginTop: 4,
  },
  profileBio: {
    fontSize: 15,
    color: '#4A6070',
    lineHeight: 22,
    marginTop: 16,
  },
  profileSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A6070',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  profileChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileChip: {
    backgroundColor: 'rgba(24,154,162,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  profileChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#189AA2',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 20,
    paddingBottom: 36,
    backgroundColor: '#FDFDFD',
    borderTopWidth: 1,
    borderTopColor: '#E8EEF2',
  },
  closeBtn: {
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
  closeBtnText: {
    color: '#FDFDFD',
    fontSize: 16,
    fontWeight: '700',
  },

  // Match modal
  matchOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchCard: {
    backgroundColor: '#FDFDFD',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 28,
    alignItems: 'center',
    width: '86%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  matchEmoji: { fontSize: 44, marginBottom: 6 },
  matchTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0C5389',
    marginBottom: 16,
  },
  matchSub: {
    fontSize: 15,
    color: '#4A6070',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  matchAvatars: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  matchAvatarWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#FDFDFD',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  matchAvatarRight: {
    marginLeft: -20,
  },
  matchAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },
  matchAvatarPlaceholder: {
    backgroundColor: '#D9E1E6',
  },
  matchInterestsWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  matchInterestsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A6070',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  matchChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  matchChip: {
    backgroundColor: 'rgba(24,154,162,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  matchChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#189AA2',
  },
  matchBtn: {
    backgroundColor: '#0C5389',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  matchBtnText: {
    color: '#FDFDFD',
    fontWeight: '700',
    fontSize: 15,
  },
  matchBtnSecondary: {
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  matchBtnSecondaryText: {
    color: '#4A6070',
    fontSize: 15,
    fontWeight: '500',
  },
});
