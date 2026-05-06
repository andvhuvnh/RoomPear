import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type ListRenderItemInfo,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, ArrowCounterClockwise, X, Star, Heart, Flag } from 'phosphor-react-native';
import type { DiscoverProfile } from '../lib/discover';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const CARD_WIDTH = SCREEN_WIDTH - 32;
export const CARD_HEIGHT = SCREEN_HEIGHT * 0.70;
const TAB_HEIGHT = 48;
const PHOTO_HEIGHT = Math.round(CARD_HEIGHT * 0.55);

type PhotoTab = 'profile' | 'place';

interface Props {
  profile: DiscoverProfile;
  onPass?: () => void;
  onLike?: () => void;
  onTopPick?: () => void;
  onUndo?: () => void;
  onReport?: () => void;
  canUndo?: boolean;
  actionDisabled?: boolean;
  showMatchReasons?: boolean;
  onUnlockReasons?: () => void;
}

export default function SwipeCard({
  profile,
  onPass, onLike, onTopPick, onUndo, onReport,
  canUndo = false, actionDisabled = false,
  showMatchReasons = false, onUnlockReasons,
}: Props) {
  const [photoTab, setPhotoTab] = useState<PhotoTab>('profile');
  const [photoIndex, setPhotoIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);

  useEffect(() => {
    setPhotoTab('profile');
    setPhotoIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [profile.id]);

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
      <ExpoImage
        source={{ uri: item }}
        style={{ width: CARD_WIDTH, height: PHOTO_HEIGHT }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={0}
        recyclingKey={`${profile.id}-${item}`}
      />
    ),
    [profile.id]
  );

  const firstName = profile.name.split(' ')[0];

  return (
    <View style={styles.card}>

      {/* ── Photo section ── */}
      <View style={[styles.photoSection, { height: PHOTO_HEIGHT }]}>
        {photoTab === 'place' && !hasListingPhotos ? (
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
              key={`${profile.id}-${photoTab}`}
              ref={listRef}
              data={activePhotos}
              keyExtractor={(_, i) => `${profile.id}-${photoTab}-${i}`}
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

            {activePhotos.length > 1 && (
              <View style={styles.progressBars} pointerEvents="none">
                {activePhotos.map((_, i) => (
                  <View key={i} style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: i <= photoIndex ? '100%' : '0%' }]} />
                  </View>
                ))}
              </View>
            )}

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.68)']}
              locations={[0.4, 0.68, 1]}
              style={styles.scrim}
              pointerEvents="none"
            />

            {onReport && (
              <TouchableOpacity style={styles.flagBtn} onPress={onReport} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Flag size={18} color="rgba(255,255,255,0.85)" weight="fill" />
              </TouchableOpacity>
            )}

            {photoTab === 'profile' && (
              <View style={styles.overlay} pointerEvents="none">
                <View style={styles.nameRow}>
                  <Text style={styles.overlayName}>{profile.name}</Text>
                  {profile.age != null && (
                    <Text style={styles.overlayAge}>{profile.age}</Text>
                  )}
                  {profile.compatibilityScore > 0 && (
                    <View style={styles.matchBadge}>
                      <Text style={styles.matchBadgeText}>{profile.compatibilityScore}% Match</Text>
                    </View>
                  )}
                </View>
                {!!profile.location && (
                  <View style={styles.locationRow}>
                    <MapPin size={13} color="rgba(255,255,255,0.85)" weight="fill" />
                    <Text style={styles.overlayLocation}>{profile.location}</Text>
                  </View>
                )}
                {(!!profile.roomType || profile.maxBudget != null) && (
                  <View style={styles.budgetRow}>
                    {!!profile.roomType && (
                      <Text style={styles.overlayBudget}>{profile.roomType}</Text>
                    )}
                    {!!profile.roomType && profile.maxBudget != null && (
                      <Text style={styles.overlayBudgetDot}>·</Text>
                    )}
                    {profile.maxBudget != null && (
                      <Text style={styles.overlayBudget}>Up to ${profile.maxBudget.toLocaleString()}/mo</Text>
                    )}
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

      {/* ── Info section — scrollable ── */}
      <ScrollView
        style={styles.infoScroll}
        contentContainerStyle={styles.infoContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {showMatchReasons && profile.matchReasons.length > 0 ? (
          <View style={styles.reasonsRow}>
            {profile.matchReasons.map((r, i) => (
              <View key={i} style={styles.reasonChip}>
                <Text style={styles.reasonChipText}>{r}</Text>
              </View>
            ))}
          </View>
        ) : !showMatchReasons && profile.matchReasons.length > 0 && onUnlockReasons ? (
          <TouchableOpacity style={styles.reasonsLock} onPress={onUnlockReasons} activeOpacity={0.75}>
            <Text style={styles.reasonsLockText}>🔒 See why you match</Text>
          </TouchableOpacity>
        ) : null}

        {profile.prompts.length > 0 ? (
          <>
            {profile.prompts.map((p, i) => (
              <View key={i} style={styles.promptCard}>
                <View style={styles.promptAccent} />
                <View style={styles.promptContent}>
                  <Text style={styles.promptQuestion} numberOfLines={2}>
                    {p.question}
                  </Text>
                  <Text style={styles.promptAnswer} numberOfLines={3}>
                    {p.answer}
                  </Text>
                </View>
              </View>
            ))}
          </>
        ) : !!profile.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : null}

        {Object.keys(profile.interests).length > 0 ? (
          Object.entries(profile.interests).map(([cat, chips]) =>
            chips.length > 0 ? (
              <View key={cat} style={styles.categoryBlock}>
                <Text style={styles.categoryLabel}>{cat}</Text>
                <View style={styles.chipsRow}>
                  {chips.map((h, i) => (
                    <View key={i} style={styles.chip}>
                      <Text style={styles.chipText}>{h}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null
          )
        ) : profile.hobbies && profile.hobbies.length > 0 ? (
          <>
            <Text style={styles.interestsLabel}>Interests</Text>
            <View style={styles.chipsRow}>
              {profile.hobbies.map((h, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{h}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* ── Vertical action column (bottom-right, absolutely positioned) ── */}
      {onPass && (
        <View style={[styles.actionColumn, actionDisabled && styles.actionBarDisabled]}>
          <TouchableOpacity
            style={styles.actionCircle}
            onPress={onLike}
            disabled={actionDisabled}
          >
            <Heart size={22} color="#2D6A4F" weight="fill" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCircle}
            onPress={onTopPick}
            disabled={actionDisabled}
          >
            <Star size={20} color="#FF9500" weight="fill" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCircle}
            onPress={onPass}
            disabled={actionDisabled}
          >
            <X size={20} color="#D4183D" weight="bold" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCircle, (!canUndo || actionDisabled) && styles.actionBtnDimmed]}
            onPress={onUndo}
            disabled={!canUndo || actionDisabled}
          >
            <ArrowCounterClockwise size={18} color="#A0A0B0" weight="bold" />
          </TouchableOpacity>
        </View>
      )}

    </View>
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
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  overlayBudget: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.78)',
  },
  overlayBudgetDot: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
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

  // ── Info (scrollable) ──
  infoScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  infoContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
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
  categoryBlock: {
    marginBottom: 10,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A0A0B0',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 5,
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

  // ── Action column (bottom-right, absolutely positioned) ──
  actionColumn: {
    position: 'absolute',
    right: 12,
    bottom: 16,
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  actionBarDisabled: { opacity: 0.4 },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDimmed: { opacity: 0.3 },
  flagBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchBadge: {
    backgroundColor: 'rgba(12,83,137,0.82)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 6,
  },
  matchBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
  },
  reasonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  reasonChip: {
    backgroundColor: 'rgba(45,106,79,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(45,106,79,0.25)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reasonChipText: {
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    color: '#2D6A4F',
  },
  reasonsLock: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  reasonsLockText: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    color: '#717182',
  },
});
