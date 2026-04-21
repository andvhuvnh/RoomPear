import { useState, useCallback } from 'react';
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
const PHOTO_HEIGHT = Math.round(CARD_HEIGHT * 0.62);

interface Props {
  profile: DiscoverProfile;
  onPress: () => void;
}

export default function SwipeCard({ profile, onPress }: Props) {
  const [photoIndex, setPhotoIndex] = useState(0);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
      setPhotoIndex(Math.max(0, Math.min(idx, profile.photoUrls.length - 1)));
    },
    [profile.photoUrls.length]
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

  return (
    <TouchableOpacity activeOpacity={0.97} onPress={onPress} style={styles.card}>
      {/* ── Photo section ── */}
      <View style={[styles.photoSection, { height: PHOTO_HEIGHT }]}>
        <FlatList
          data={profile.photoUrls}
          keyExtractor={(_, i) => `p${i}`}
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

        {/* Story-style progress bars */}
        {profile.photoUrls.length > 1 && (
          <View style={styles.progressBars} pointerEvents="none">
            {profile.photoUrls.map((_, i) => (
              <View key={i} style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: i <= photoIndex ? '100%' : '0%' },
                  ]}
                />
              </View>
            ))}
          </View>
        )}

        {/* "Has a place" badge */}
        {profile.hasListing && (
          <View style={styles.listingBadge} pointerEvents="none">
            <Text style={styles.listingBadgeText}>🏠 Has a place</Text>
          </View>
        )}

        {/* Deep gradient scrim */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.72)']}
          locations={[0.35, 0.65, 1]}
          style={styles.scrim}
          pointerEvents="none"
        />

        {/* Name + location overlay */}
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
      </View>

      {/* ── Info section ── */}
      <View style={styles.infoSection}>
        {!!profile.bio && (
          <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>
        )}

        {profile.hobbies && profile.hobbies.length > 0 && (
          <>
            <Text style={styles.interestsLabel}>Interests</Text>
            <View style={styles.chipsRow}>
              {profile.hobbies.slice(0, 6).map((h, i) => (
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

  // Photo
  photoSection: {
    width: CARD_WIDTH,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E0E0E0',
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
  listingBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(26,44,36,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    zIndex: 3,
  },
  listingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
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

  // Info
  infoSection: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  bio: {
    fontSize: 14,
    color: '#717182',
    lineHeight: 20,
    marginBottom: 12,
  },
  interestsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A0A0B0',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
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
});
