import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type ListRenderItemInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'phosphor-react-native';
import type { DiscoverProfile } from '../lib/discover';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const CARD_WIDTH = SCREEN_WIDTH - 32;
export const CARD_HEIGHT = SCREEN_HEIGHT * 0.70;
const TAB_HEIGHT = 48;
const PHOTO_HEIGHT = Math.round(CARD_HEIGHT * 0.57);

type PhotoTab = 'profile' | 'place';

interface Props {
  profile: DiscoverProfile;
  onPress: () => void;
}

export default function SwipeCard({ profile, onPress }: Props) {
  const [photoTab, setPhotoTab] = useState<PhotoTab>('profile');
  const [photoIndex, setPhotoIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);

  const profilePhotos = profile.photoUrls.slice(0, profile.profilePhotoCount);
  const listingPhotos = profile.photoUrls.slice(profile.profilePhotoCount);
  const activePhotos = photoTab === 'profile' ? profilePhotos : listingPhotos;
  const hasListingPhotos = listingPhotos.length > 0;

  const switchTab = useCallback((tab: PhotoTab) => {
    setPhotoTab(tab);
    setPhotoIndex(0);
  }, []);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
      setPhotoIndex(Math.max(0, Math.min(idx, activePhotos.length - 1)));
    },
    [activePhotos.length]
  );

  const renderPhoto = useCallback(
    ({ item }: ListRenderItemInfo<string>) => (
      <Image
        source={{ uri: item }}
        style={{ width: CARD_WIDTH, height: PHOTO_HEIGHT }}
        resizeMode="cover"
      />
    ),
    []
  );

  const firstName = profile.name.split(' ')[0];

  return (
    <TouchableOpacity activeOpacity={0.97} onPress={onPress} style={styles.card}>

      {/* ── Photo section ── */}
      <View style={[styles.photoSection, { height: PHOTO_HEIGHT }]}>
        {photoTab === 'place' && !hasListingPhotos ? (
          /* No listing placeholder */
          <View style={styles.noListingWrap}>
            <Text style={styles.noListingIcon}>🏠</Text>
            <Text style={styles.noListingTitle}>
              {profile.hasListing ? 'No photos yet' : 'No place listed'}
            </Text>
            <Text style={styles.noListingSubtitle}>
              {profile.hasListing
                ? `${firstName} hasn't added place photos`
                : `${firstName} hasn't listed a place`}
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              key={photoTab}
              ref={listRef}
              data={activePhotos}
              keyExtractor={(_, i) => `${photoTab}-${i}`}
              renderItem={renderPhoto}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              onMomentumScrollEnd={onMomentumScrollEnd}
              getItemLayout={(_, index) => ({
                length: CARD_WIDTH,
                offset: CARD_WIDTH * index,
                index,
              })}
              scrollEventThrottle={16}
            />

            {/* Progress bars */}
            {activePhotos.length > 1 && (
              <View style={styles.progressBars} pointerEvents="none">
                {activePhotos.map((_, i) => (
                  <View key={i} style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: i <= photoIndex ? '100%' : '0%' }]} />
                  </View>
                ))}
              </View>
            )}

            {/* Gradient scrim */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.68)']}
              locations={[0.4, 0.68, 1]}
              style={styles.scrim}
              pointerEvents="none"
            />

            {/* Overlay — name/location on profile tab only */}
            {photoTab === 'profile' && (
              <View style={styles.overlay} pointerEvents="none">
                <View style={styles.nameRow}>
                  <Text style={styles.overlayName}>{profile.name}</Text>
                  {profile.age != null && (
                    <Text style={styles.overlayAge}>{profile.age}</Text>
                  )}
                </View>
                {!!profile.location && (
                  <View style={styles.locationRow}>
                    <MapPin size={13} color="rgba(255,255,255,0.85)" weight="fill" />
                    <Text style={styles.overlayLocation}>{profile.location}</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </View>

      {/* ── Tab strip ── */}
      <View style={styles.tabStrip}>
        <TouchableOpacity
          style={[styles.tabPill, photoTab === 'profile' && styles.tabPillActive]}
          onPress={() => switchTab('profile')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, photoTab === 'profile' && styles.tabTextActive]}>
            {firstName}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabPill,
            photoTab === 'place' && styles.tabPillActive,
            !profile.hasListing && styles.tabPillDimmed,
          ]}
          onPress={() => switchTab('place')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, photoTab === 'place' && styles.tabTextActive]}>
            🏠  Place
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Info section ── */}
      <View style={styles.infoSection}>
        {/* Prompts — shown first, most personal content */}
        {profile.prompts.length > 0 ? (
          <View style={styles.promptCard}>
            <View style={styles.promptAccent} />
            <View style={styles.promptContent}>
              <Text style={styles.promptQuestion} numberOfLines={2}>
                {profile.prompts[0].question}
              </Text>
              <Text style={styles.promptAnswer} numberOfLines={3}>
                {profile.prompts[0].answer}
              </Text>
            </View>
          </View>
        ) : !!profile.bio ? (
          <Text style={styles.bio} numberOfLines={3}>{profile.bio}</Text>
        ) : null}

        {profile.hobbies && profile.hobbies.length > 0 && (
          <>
            <Text style={styles.interestsLabel}>Interests</Text>
            <View style={styles.chipsRow}>
              {profile.hobbies.slice(0, 5).map((h, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{h}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },

  // ── Photo ──
  photoSection: {
    width: CARD_WIDTH,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E8E8E8',
  },
  progressBars: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 3,
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: PHOTO_HEIGHT * 0.55,
    zIndex: 1,
  },
  overlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 16,
    zIndex: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  overlayName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  overlayAge: {
    fontSize: 24,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.88)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  overlayLocation: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },

  // ── No listing placeholder ──
  noListingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F2',
    gap: 6,
  },
  noListingIcon: { fontSize: 40 },
  noListingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A2C24',
  },
  noListingSubtitle: {
    fontSize: 14,
    color: '#717182',
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // ── Tab strip ──
  tabStrip: {
    height: TAB_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  tabPill: {
    flex: 1,
    height: 32,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  tabPillActive: {
    backgroundColor: '#1A2C24',
  },
  tabPillDimmed: {
    opacity: 0.4,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#717182',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  // ── Info ──
  infoSection: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  bio: {
    fontSize: 14,
    color: '#717182',
    lineHeight: 20,
    marginBottom: 10,
  },
  interestsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A0A0B0',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 7,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: 'rgba(45,106,79,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
    backgroundColor: 'rgba(45,106,79,0.04)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D6A4F',
  },

  // ── Prompt card ──
  promptCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(45,106,79,0.05)',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  promptAccent: {
    width: 3,
    backgroundColor: '#2D6A4F',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  promptContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  promptQuestion: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A0A0B0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  promptAnswer: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2C24',
    lineHeight: 20,
  },
});
