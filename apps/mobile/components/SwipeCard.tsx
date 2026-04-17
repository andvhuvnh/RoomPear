/**
 * SwipeCard — split-panel profile card for the Discover deck.
 * Top 60%: photo carousel with dot indicators.
 * Bottom 40%: info panel (name, age, location, bio, hobby chips).
 */

import { useState, useRef, useCallback } from 'react';
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
import type { DiscoverProfile } from '../lib/discover';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Fixed card dimensions — computed once so FlatList getItemLayout works
export const CARD_WIDTH = SCREEN_WIDTH - 32; // 16px padding each side
export const CARD_HEIGHT = SCREEN_HEIGHT * 0.63;
const PHOTO_HEIGHT = Math.round(CARD_HEIGHT * 0.60);

interface Props {
  profile: DiscoverProfile;
  onPress: () => void;
}

export default function SwipeCard({ profile, onPress }: Props) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);

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
    <TouchableOpacity
      activeOpacity={0.97}
      onPress={onPress}
      style={styles.card}
    >
      {/* ── Photo section ── */}
      <View style={[styles.photoSection, { height: PHOTO_HEIGHT }]}>
        <FlatList
          ref={listRef}
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

        {/* Dot indicators */}
        {profile.photoUrls.length > 1 && (
          <View style={styles.dots} pointerEvents="none">
            {profile.photoUrls.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === photoIndex ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>
        )}

        {/* Photo counter badge */}
        {profile.photoUrls.length > 1 && (
          <View style={styles.photoBadge} pointerEvents="none">
            <Text style={styles.photoBadgeText}>
              {photoIndex + 1} / {profile.photoUrls.length}
            </Text>
          </View>
        )}
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Info section ── */}
      <View style={styles.infoSection}>
        {/* Name + age row */}
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
          {profile.age != null && (
            <Text style={styles.age}>{profile.age}</Text>
          )}
        </View>

        {/* Location + listing badge */}
        <View style={styles.locationRow}>
          {!!profile.location && (
            <Text style={styles.location} numberOfLines={1}>
              📍 {profile.location}
            </Text>
          )}
          {profile.hasListing && (
            <View style={styles.listingBadge}>
              <Text style={styles.listingBadgeText}>🏠 Has a place</Text>
            </View>
          )}
        </View>

        {/* Bio */}
        {!!profile.bio && (
          <Text style={styles.bio} numberOfLines={2}>
            {profile.bio}
          </Text>
        )}

        {/* Hobby chips */}
        {profile.hobbies && profile.hobbies.length > 0 && (
          <View style={styles.chipsRow}>
            {profile.hobbies.slice(0, 5).map((h, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{h}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tap hint */}
        <Text style={styles.tapHint}>Tap to view full profile</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    backgroundColor: '#FDFDFD',
    overflow: 'hidden',
    shadowColor: '#0C5389',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 8,
  },

  // Photo
  photoSection: {
    width: CARD_WIDTH,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#D9E1E6',
  },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
    backgroundColor: '#FDFDFD',
  },
  dotInactive: {
    width: 5,
    backgroundColor: 'rgba(253,253,253,0.5)',
  },
  photoBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  photoBadgeText: {
    color: '#FDFDFD',
    fontSize: 11,
    fontWeight: '600',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#E8EEF2',
  },

  // Info
  infoSection: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: '#FDFDFD',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0C5389',
    flexShrink: 1,
  },
  age: {
    fontSize: 20,
    fontWeight: '400',
    color: '#0C5389',
    opacity: 0.7,
  },
  location: {
    fontSize: 13,
    color: '#189AA2',
    fontWeight: '500',
  },
  bio: {
    fontSize: 13,
    color: '#4A6070',
    lineHeight: 19,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  chip: {
    backgroundColor: 'rgba(24,154,162,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#189AA2',
  },
  tapHint: {
    fontSize: 11,
    color: '#9AA',
    marginTop: 4,
    textAlign: 'right',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  listingBadge: {
    backgroundColor: 'rgba(70,189,127,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#46BD7F',
  },
  listingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#46BD7F',
  },
});
