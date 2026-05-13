import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MapPin, Flag, User, Buildings, Briefcase, CurrencyDollar } from 'phosphor-react-native';
import { fonts, serifFonts } from '../lib/typography';
import { INTEREST_CATEGORIES as CATEGORY_META } from '../screens/profile/userProfileConstants';
import type { DiscoverProfile } from '../lib/discover';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SIDE_MARGIN = 10;
const CARD_GAP = 8;

export const CARD_WIDTH = SCREEN_WIDTH - SIDE_MARGIN * 2;
export const CARD_HEIGHT = SCREEN_HEIGHT * 0.78;
const PHOTO_HEIGHT = Math.round(CARD_WIDTH * (4 / 3));

type PhotoTab = 'profile' | 'place';

interface Props {
  profile: DiscoverProfile;
  onReport?: () => void;
  showMatchReasons?: boolean;
  onUnlockReasons?: () => void;
}

export default function SwipeCard({
  profile,
  onReport,
  showMatchReasons = false,
  onUnlockReasons,
}: Props) {
  const [photoTab, setPhotoTab] = useState<PhotoTab>('profile');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [prevPhotoUri, setPrevPhotoUri] = useState<string | null>(null);
  const crossfadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setPhotoTab('profile');
    setPhotoIndex(0);
  }, [profile.id]);

  const profilePhotos = profile.photoUrls.slice(0, profile.profilePhotoCount);
  const listingPhotos = profile.photoUrls.slice(profile.profilePhotoCount);
  const activePhotos = photoTab === 'profile' ? profilePhotos : listingPhotos;

  const switchTab = useCallback((tab: PhotoTab) => {
    setPhotoTab(tab);
    setPhotoIndex(0);
  }, []);

  const advancePhoto = useCallback((direction: 'next' | 'prev') => {
    const next = direction === 'next'
      ? Math.min(photoIndex + 1, activePhotos.length - 1)
      : Math.max(photoIndex - 1, 0);
    if (next === photoIndex) return;

    setPrevPhotoUri(activePhotos[photoIndex]);
    crossfadeAnim.setValue(0);
    setPhotoIndex(next);
    Animated.timing(crossfadeAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => setPrevPhotoUri(null));
  }, [photoIndex, activePhotos, crossfadeAnim]);

  const score = profile.compatibilityScore;
  const matchDotColor = score < 30 ? '#D4183D' : score <= 70 ? '#FF9500' : '#2D6A4F';

  const activeCategories = CATEGORY_META.filter(cat => (profile.interests[cat.key]?.length ?? 0) > 0);
  const fallbackChips = activeCategories.length === 0 ? (profile.hobbies ?? []) : [];
  const hasInterests = activeCategories.length > 0 || fallbackChips.length > 0;
  const hasResponses = profile.prompts.length > 0 || !!profile.bio;
  const listingRentText = profile.listingRent != null
    ? `$${profile.listingRent.toLocaleString()}/mo`
    : null;

  return (
    <View style={styles.card}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        bounces
        decelerationRate={0.993}
        scrollEventThrottle={16}
      >
        {/* ── Photo card ── */}
        <View style={styles.photoCard}>
          <View style={{ width: CARD_WIDTH, height: PHOTO_HEIGHT }}>
            {prevPhotoUri ? (
              <ExpoImage
                source={{ uri: prevPhotoUri }}
                style={[StyleSheet.absoluteFill, { width: CARD_WIDTH, height: PHOTO_HEIGHT }]}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : null}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: crossfadeAnim }]}>
              <ExpoImage
                source={{ uri: activePhotos[photoIndex] }}
                style={{ width: CARD_WIDTH, height: PHOTO_HEIGHT }}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={`${profile.id}-${photoTab}-${photoIndex}`}
              />
            </Animated.View>
          </View>

          {/* Tap zones */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.tapZoneLeft}
              onPress={() => advancePhoto('prev')}
              activeOpacity={1}
            />
            <TouchableOpacity
              style={styles.tapZoneRight}
              onPress={() => advancePhoto('next')}
              activeOpacity={1}
            />
          </View>

          {/* Dot indicators */}
          {activePhotos.length > 1 && (
            <View style={styles.dotsRow} pointerEvents="none">
              {activePhotos.map((_, i) => (
                <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
              ))}
            </View>
          )}

          {/* Tab pill */}
          {profile.hasListing && (
            <View style={styles.tabPill} pointerEvents="box-none">
              <View style={styles.tabPillInner}>
                <TouchableOpacity
                  style={[styles.tabOption, photoTab === 'profile' && styles.tabOptionActive]}
                  onPress={() => switchTab('profile')}
                  activeOpacity={0.8}
                >
                  <User size={18} color={photoTab === 'profile' ? '#FFFFFF' : 'rgba(255,255,255,0.55)'} weight="bold" />
                </TouchableOpacity>
                <View style={styles.tabDivider} />
                <TouchableOpacity
                  style={[styles.tabOption, photoTab === 'place' && styles.tabOptionActive]}
                  onPress={() => switchTab('place')}
                  activeOpacity={0.8}
                >
                  <Buildings size={18} color={photoTab === 'place' ? '#FFFFFF' : 'rgba(255,255,255,0.55)'} weight="bold" />
                </TouchableOpacity>
              </View>
            </View>
          )}

        </View>

        {/* ── Info card ── */}
        <View style={styles.sectionCard}>
          <View style={styles.nameRow}>
            <Text style={styles.infoName}>{profile.name}</Text>
            {profile.age != null && <Text style={styles.infoAge}>{profile.age}</Text>}
          </View>

          {!!profile.location && (
            <View style={styles.metaRow}>
              <MapPin size={12} color="#A0A0B0" weight="fill" />
              <Text style={styles.metaText}>{profile.location}</Text>
            </View>
          )}

          {!!profile.occupation && (
            <View style={styles.metaRow}>
              <Briefcase size={12} color="#A0A0B0" weight="fill" />
              <Text style={styles.metaText}>{profile.occupation}</Text>
            </View>
          )}

          {profile.hasListing && (listingRentText || profile.listingRoomType) && (
            <View style={styles.placeMetaRow}>
              <CurrencyDollar size={13} color="#2D6A4F" weight="bold" />
              <Text style={styles.placeMetaLabel}>Listing:</Text>
              {listingRentText && <Text style={styles.placeMetaText}>{listingRentText}</Text>}
              {listingRentText && profile.listingRoomType && <Text style={styles.placeMetaDot}>·</Text>}
              {profile.listingRoomType && <Text style={styles.placeMetaText}>{profile.listingRoomType} room</Text>}
            </View>
          )}

          {(!!profile.roomType || profile.maxBudget != null) && (
            <View style={styles.metaRow}>
              {!!profile.roomType && <Text style={styles.metaText}>{profile.roomType} room</Text>}
              {!!profile.roomType && profile.maxBudget != null && <Text style={styles.metaDot}>·</Text>}
              {profile.maxBudget != null && (
                <Text style={styles.metaText}>
                  {profile.minBudget != null
                    ? `$${profile.minBudget.toLocaleString()} – $${profile.maxBudget.toLocaleString()}/mo`
                    : `Up to $${profile.maxBudget.toLocaleString()}/mo`}
                </Text>
              )}
            </View>
          )}

          {profile.compatibilityScore > 0 && (
            <View style={styles.matchRow}>
              {showMatchReasons && profile.matchReasons.length > 0 ? (
                <View style={styles.matchPill}>
                  <View style={[styles.matchDot, { backgroundColor: matchDotColor }]} />
                  <Text style={styles.matchScore}>{profile.compatibilityScore}% match</Text>
                  <View style={styles.matchPillDivider} />
                  <Text style={styles.matchReasons}>You both like: {profile.matchReasons.join(', ')}</Text>
                </View>
              ) : onUnlockReasons ? (
                <TouchableOpacity style={styles.matchPill} onPress={onUnlockReasons} activeOpacity={0.75}>
                  <View style={[styles.matchDot, { backgroundColor: matchDotColor }]} />
                  <Text style={styles.matchScore}>{profile.compatibilityScore}% match</Text>
                  <View style={styles.matchPillDivider} />
                  <Text style={styles.matchReasons}>See why you match</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.matchPill}>
                  <View style={[styles.matchDot, { backgroundColor: matchDotColor }]} />
                  <Text style={styles.matchScore}>{profile.compatibilityScore}% match</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Responses card ── */}
        {hasResponses && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardLabel}>RESPONSES</Text>
            {profile.prompts.length > 0 ? (
              profile.prompts.map((p, i) => (
                <View key={i} style={i > 0 ? styles.promptItemSpaced : styles.promptItem}>
                  {i > 0 && <View style={styles.promptDivider} />}
                  <Text style={styles.promptQuestion}>{p.question.toUpperCase()}</Text>
                  <Text style={styles.promptAnswer}>{p.answer}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.bio}>{profile.bio}</Text>
            )}
          </View>
        )}

        {/* ── Interests card ── */}
        {hasInterests && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardLabel}>INTERESTS</Text>
            {activeCategories.map((cat, i) => (
              <View key={cat.key} style={i > 0 ? { marginTop: 6 } : undefined}>
                {i > 0 && <View style={styles.promptDivider} />}
                <Text style={styles.categoryLabel}>{cat.label.toUpperCase()}</Text>
                <View style={styles.chipsRow}>
                  {profile.interests[cat.key].map((item, j) => (
                    <View key={j} style={styles.chip}>
                      <Text style={styles.chipText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
            {fallbackChips.length > 0 && (
              <View style={styles.chipsRow}>
                {fallbackChips.map((h, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{h}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Report ── */}
        {onReport && (
          <TouchableOpacity style={styles.reportBtn} onPress={onReport} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
            <Flag size={13} color="#C0C0C8" weight="fill" />
            <Text style={styles.reportBtnText}>Report</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 14,
  },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: {
    paddingBottom: 120,
    gap: CARD_GAP,
  },

  // ── Photo card ──
  photoCard: {
    height: PHOTO_HEIGHT,
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    overflow: 'hidden',
  },
  tabPill: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 4,
  },
  tabPillInner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20,20,20,0.72)',
    borderRadius: 50,
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tabOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
  },
  tabOptionActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tabDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 8,
  },
  tapZoneLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '40%',
  },
  tapZoneRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '60%',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    zIndex: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 18,
    borderRadius: 3,
  },
  scrollHint: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  scrollHintText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.60)',
    letterSpacing: 2,
  },

  // ── Section cards ──
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 6,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionCardLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#717182',
    letterSpacing: 1.5,
    marginBottom: 12,
  },

  // ── Info card ──
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
  },
  infoName: {
    fontFamily: fonts.extraBold,
    fontSize: 28,
    color: '#1A1A2E',
    letterSpacing: -0.5,
  },
  infoAge: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: '#A0A0B0',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  metaText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#A0A0B0',
  },
  metaDot: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#C8C8D0',
  },
  placeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 7,
    backgroundColor: 'rgba(45,106,79,0.08)',
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  placeMetaText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#2D6A4F',
  },
  placeMetaLabel: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: '#1F4F3A',
  },
  placeMetaDot: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: 'rgba(45,106,79,0.45)',
  },
  matchRow: {
    marginTop: 8,
  },
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#F5F5F8',
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  matchScore: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: '#1A1A2E',
  },
  matchPillDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#D8D8E0',
  },
  matchReasons: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#717182',
    flexShrink: 1,
  },
  matchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // ── Responses card ──
  promptItem: {
    paddingVertical: 0,
  },
  promptItemSpaced: {
    paddingVertical: 0,
  },
  promptDivider: {
    height: 1,
    backgroundColor: '#F0F0F5',
    marginVertical: 5,
  },
  promptQuestion: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#C0C0C8',
    letterSpacing: 1,
    marginBottom: 5,
  },
  promptAnswer: {
    fontFamily: serifFonts.bold,
    fontSize: 20,
    color: '#1A1A2E',
    lineHeight: 26,
  },
  bio: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#717182',
    lineHeight: 21,
  },

  // ── Interests card ──
  interestItem: {},
  interestItemSpaced: {},
  categoryLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#C0C0C8',
    letterSpacing: 1,
    marginBottom: 3,
  },
  interestItems: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#1A1A2E',
    lineHeight: 22,
  },
  interestDivider: {
    fontFamily: fonts.regular,
    color: '#C0C0C8',
  },

  // ── Report ──
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D8D8E0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
  },
  chipText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#1A1A2E',
  },
  reportBtnText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#C0C0C8',
  },
});
