import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Listing } from '../../lib/listings';

export type ProfilePromptEntry = { question: string; answer: string };

/** First token + remainder so we can show full name (e.g. Alex + Morgan) when applicable. */
function splitNameForHeader(full: string): { first: string; rest: string | null } {
  const t = full.trim();
  if (!t) return { first: '', rest: null };
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? '', rest: null };
  return { first: parts[0]!, rest: parts.slice(1).join(' ') };
}

type Props = {
  displayName: string;
  displayAge: number | null;
  profileHobbies: string[];
  profileInterests: string[];
  listing: Listing | null;
  /** Where the user is searching for roommates (preferences); shown as listing location. */
  searchLocationLine: string;
  listingPhotoUrls: string[];
  prompts: ProfilePromptEntry[];
};

export default function ProfileOverviewSection({
  displayName,
  displayAge,
  profileHobbies,
  profileInterests,
  listing,
  searchLocationLine,
  listingPhotoUrls,
  prompts,
}: Props) {
  const { first: nameFirst, rest: nameRest } = splitNameForHeader(displayName);
  const metaSubtitle = [
    searchLocationLine.trim() || null,
    displayAge != null && !Number.isNaN(displayAge) ? String(displayAge) : null,
  ]
    .filter(Boolean)
    .join(' \u00B7 ');

  return (
    <>
      <View style={styles.profileIdentityHeader}>
        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(26, 51, 41, 0.10)',
            'rgba(26, 51, 41, 0.04)',
            'rgba(245, 250, 247, 0.42)',
            'rgba(255, 255, 255, 0)',
          ]}
          locations={[0, 0.22, 0.52, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.profileIdentityHeaderWash}
        />
        <View style={styles.profileIdentityHeaderInner}>
          <Text style={styles.profileIdentityKicker}>All about</Text>
          {displayName ? (
            <Text style={styles.profileIdentityHero}>
              <Text style={styles.profileIdentityHeroFirst}>{nameFirst}</Text>
              {nameRest ? <Text style={styles.profileIdentityHeroRest}>{` ${nameRest}`}</Text> : null}
            </Text>
          ) : (
            <Text style={styles.profileIdentityHeroPlaceholder}>Your profile</Text>
          )}
          {metaSubtitle ? <Text style={styles.profileIdentitySubtitle}>{metaSubtitle}</Text> : null}
        </View>
      </View>

      {listing ? (
        <View style={styles.profileListingSection}>
          <View style={styles.profileListingHeader}>
            <Text style={styles.profileListingTitle}>Your Listing</Text>
            {listing.rent != null ? <Text style={styles.profileListingRent}>${listing.rent}/mo</Text> : null}
          </View>
          {searchLocationLine ? <Text style={styles.profileListingMeta}>{searchLocationLine}</Text> : null}
          {listingPhotoUrls.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.profileListingPhotosRow}
            >
              {listingPhotoUrls.map((url, idx) => (
                <Image key={`${url}-${idx}`} source={{ uri: url }} style={styles.profileListingPhoto} />
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      <View style={styles.profileMetaSection}>
        <Text style={styles.profileCategoryTitle}>Hobbies & Interests</Text>
        {profileHobbies.length > 0 ? (
          <>
            <Text style={styles.profileCategoryLabel}>Hobbies</Text>
            <View style={styles.profileInterestsWrap}>
              {profileHobbies.map((hobby) => (
                <View key={`hobby-${hobby}`} style={styles.profileInterestChip}>
                  <Text style={styles.profileInterestText}>{hobby}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
        {profileInterests.length > 0 ? (
          <View
            style={[
              styles.profileInterestsWrap,
              profileHobbies.length > 0 && styles.profileInterestsWrapAfterHobbies,
            ]}
          >
            {profileInterests.map((interest) => (
              <View key={`interest-${interest}`} style={styles.profileInterestChip}>
                <Text style={styles.profileInterestText}>{interest}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {profileHobbies.length === 0 && profileInterests.length === 0 ? (
          <Text style={styles.profileMetaHint}>
            Add hobbies and interests in Adjust profile to help others understand your vibe.
          </Text>
        ) : null}
      </View>

      {prompts.length > 0 ? (
        <View style={styles.profilePromptsSection}>
          <Text style={styles.profileCategoryTitle}>Prompts</Text>
          {prompts.map((p, i) => (
            <View key={`prompt-${i}`} style={i > 0 ? styles.profilePromptDivider : undefined}>
              <Text style={styles.profilePromptQuestion}>{p.question}</Text>
              <Text style={styles.profilePromptAnswer}>{p.answer}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  profileIdentityHeader: {
    marginTop: 8,
    marginBottom: 6,
    marginHorizontal: 12,
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  profileIdentityHeaderWash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  profileIdentityHeaderInner: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    zIndex: 1,
  },
  profileIdentityKicker: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(45, 79, 66, 0.78)',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  profileIdentityHero: {
    marginTop: 10,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1,
  },
  profileIdentityHeroFirst: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0c0c0c',
    letterSpacing: -1,
    lineHeight: 38,
  },
  profileIdentityHeroRest: {
    fontSize: 32,
    fontWeight: '600',
    color: '#1c1c1c',
    letterSpacing: -0.85,
    lineHeight: 38,
  },
  profileIdentityHeroPlaceholder: {
    marginTop: 10,
    fontSize: 32,
    fontWeight: '700',
    color: '#6b6b76',
    letterSpacing: -0.85,
    lineHeight: 38,
  },
  profileIdentitySubtitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '500',
    color: '#5c5f6e',
    letterSpacing: -0.15,
    lineHeight: 21,
  },
  profileMetaSection: {
    marginTop: 10,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  profileCategoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#252525',
    marginBottom: 8,
  },
  profileCategoryLabel: {
    marginTop: 2,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#717182',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  profileMetaHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#717182',
    lineHeight: 18,
  },
  profileInterestsWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  profileInterestsWrapAfterHobbies: {
    marginTop: 12,
  },
  profileInterestChip: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  profileInterestText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#252525',
  },
  profileListingSection: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  profileListingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileListingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#252525',
  },
  profileListingRent: {
    fontSize: 16,
    fontWeight: '700',
    color: '#252525',
  },
  profileListingMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#717182',
  },
  profileListingPhotosRow: {
    marginTop: 10,
    gap: 8,
    paddingRight: 4,
  },
  profileListingPhoto: {
    width: 114,
    height: 86,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  profilePromptsSection: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  profilePromptDivider: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  profilePromptQuestion: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: '#717182',
    lineHeight: 18,
  },
  profilePromptAnswer: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '600',
    color: '#252525',
    lineHeight: 21,
  },
});
