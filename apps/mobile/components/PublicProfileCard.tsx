import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  type ListRenderItemInfo,
  type LayoutChangeEvent,
} from 'react-native';

const CARD_RADIUS = 16;
const IMAGE_HEIGHT = 420;
const IMAGE_HEIGHT_IMMERSIVE = 500;

export type PublicProfileCardProps = {
  imageUrls: string[];
  name: string;
  age: number | null;
  location: string;
  /** Short intro shown under age / location */
  bio?: string | null;
  hobbies?: string[] | null;
  /** Edge-to-edge hero: name/meta on image, minimal chrome */
  variant?: 'default' | 'immersive';
};

export default function PublicProfileCard({
  imageUrls,
  name,
  age,
  location,
  bio,
  hobbies,
  variant = 'default',
}: PublicProfileCardProps) {
  const immersive = variant === 'immersive';
  const imageHeight = immersive ? IMAGE_HEIGHT_IMMERSIVE : IMAGE_HEIGHT;
  const [cardWidth, setCardWidth] = useState(
    () => Dimensions.get('window').width - 40
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const onCardLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setCardWidth(w);
  }, []);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / cardWidth);
      setActiveIndex(Math.min(Math.max(0, idx), imageUrls.length - 1));
    },
    [cardWidth, imageUrls.length]
  );

  const renderImage = useCallback(
    ({ item }: ListRenderItemInfo<string>) => (
      <View style={{ width: cardWidth, height: imageHeight }}>
        <Image
          source={{ uri: item }}
          style={styles.coverImage}
          resizeMode="cover"
        />
      </View>
    ),
    [cardWidth, imageHeight]
  );

  const displayName = name.trim() || 'Your name';
  const agePart =
    age != null && !Number.isNaN(age) ? `${age}` : null;
  const metaParts = [agePart, location.trim() || null].filter(Boolean);
  const metaLine = metaParts.join(' · ');
  const bioText = bio?.trim() ?? '';
  const hobbyList = (hobbies ?? []).filter((h) => typeof h === 'string' && h.trim().length > 0);

  const detailsSection = (
    <>
      {bioText ? <Text style={styles.bio}>{bioText}</Text> : null}
      {hobbyList.length > 0 ? (
        <View style={styles.hobbiesRow}>
          {hobbyList.map((h, i) => (
            <View key={`${h}-${i}`} style={styles.hobbyChip}>
              <Text style={styles.hobbyChipText}>{h.trim()}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );

  const overlayMeta = immersive ? (
    <View style={styles.immersiveOverlay} pointerEvents="none">
      <Text style={styles.immersiveName} numberOfLines={2}>
        {displayName}
      </Text>
      {metaLine ? (
        <Text style={styles.immersiveMeta} numberOfLines={2}>
          {metaLine}
        </Text>
      ) : null}
    </View>
  ) : null;

  if (imageUrls.length === 0) {
    return (
      <View style={[styles.card, immersive ? styles.cardOuterImmersive : styles.cardOuter]} onLayout={onCardLayout}>
        <View style={immersive ? styles.emptyHeroWrap : undefined}>
          <View style={[styles.emptyCover, { width: cardWidth, height: imageHeight }]}>
            <Text style={styles.emptyCoverText}>Add photos to see your card</Text>
          </View>
          {immersive ? overlayMeta : null}
        </View>
        {!immersive ? (
          <View style={styles.infoBlock}>
            <Text style={styles.name}>{displayName}</Text>
            {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}
            {detailsSection}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, immersive ? styles.cardOuterImmersive : styles.cardOuter, immersive && styles.cardImmersive]} onLayout={onCardLayout}>
      <View style={[styles.imageWrap, immersive && styles.imageWrapImmersive]}>
        <FlatList
          data={imageUrls}
          keyExtractor={(_, index) => `photo-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          renderItem={renderImage}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, index) => ({
            length: cardWidth,
            offset: cardWidth * index,
            index,
          })}
        />
        <View style={[styles.bottomScrim, immersive && styles.bottomScrimImmersive]} pointerEvents="none" />
        {immersive ? overlayMeta : null}
        {imageUrls.length > 1 ? (
          <View style={[styles.dots, immersive && styles.dotsImmersive]} pointerEvents="none">
            {imageUrls.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === activeIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>

      {!immersive ? (
        <View style={styles.infoBlock}>
          <Text style={styles.name} numberOfLines={2}>
            {displayName}
          </Text>
          {metaLine ? (
            <Text style={styles.meta} numberOfLines={2}>
              {metaLine}
            </Text>
          ) : null}
          {detailsSection}
        </View>
      ) : detailsSection ? (
        <View style={styles.infoBlockCompact}>{detailsSection}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  cardOuterImmersive: {
    width: '100%',
    alignSelf: 'stretch',
  },
  emptyHeroWrap: {
    position: 'relative',
    width: '100%',
    alignSelf: 'stretch',
  },
  card: {
    backgroundColor: '#FDFDFD',
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    shadowColor: '#0C5389',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  cardImmersive: {
    borderRadius: 22,
    shadowOpacity: 0.16,
    shadowRadius: 28,
  },
  imageWrap: {
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
    overflow: 'hidden',
    position: 'relative',
  },
  imageWrapImmersive: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#D9E1E6',
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 88,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  bottomScrimImmersive: {
    height: 140,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  immersiveOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 22,
    paddingTop: 48,
    zIndex: 2,
  },
  immersiveName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  immersiveMeta: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dots: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsImmersive: {
    bottom: 108,
    zIndex: 3,
  },
  dot: {
    marginHorizontal: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#FDFDFD',
    width: 18,
  },
  dotInactive: {
    backgroundColor: 'rgba(253,253,253,0.45)',
  },
  infoBlock: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
  },
  infoBlockCompact: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0C5389',
    letterSpacing: -0.3,
  },
  meta: {
    marginTop: 6,
    fontSize: 16,
    color: '#189AA2',
    fontWeight: '500',
  },
  bio: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 22,
    color: '#0C5389',
    opacity: 0.92,
  },
  hobbiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginHorizontal: -4,
    marginBottom: -8,
  },
  hobbyChip: {
    backgroundColor: 'rgba(24, 154, 162, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  hobbyChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#189AA2',
  },
  emptyCover: {
    height: IMAGE_HEIGHT,
    backgroundColor: '#D9E1E6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyCoverText: {
    fontSize: 15,
    color: '#0C5389',
    textAlign: 'center',
    opacity: 0.85,
  },
});
