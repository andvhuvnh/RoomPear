import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import { getProfileImageUrls, getProfileImageUrl, pickImage, uploadListingPhoto, pickListingImage } from '../lib/storage';
import { getPreferences, savePreferences, type Preferences } from '../lib/preferences';
import { formatLocationLine, profilePhotoPathsFromRow } from '../lib/profileDisplay';
import { appendProfilePhoto, removeProfilePhotoAt, replaceProfilePhotoAt, MAX_PROFILE_PHOTOS } from '../lib/profilePhotos';
import PublicProfileCard from '../components/PublicProfileCard';
import * as Clipboard from 'expo-clipboard';
import { redeemReferralCode, redeemErrorMessage } from '../lib/referrals';
import { getListing, saveListing, deleteListing, type Listing } from '../lib/listings';

// ─── Shared constants ────────────────────────────────────────────────────────

const DEALBREAKER_ITEMS = [
  { key: 'smoking',    label: 'Smoking indoors' },
  { key: 'pets',       label: 'Pets in the unit' },
  { key: 'parties',    label: 'Frequent parties' },
  { key: 'early_bird', label: 'Noise before 8 am' },
  { key: 'night_owl',  label: 'Noise after 11 pm' },
  { key: 'guests',     label: 'Overnight guests' },
  { key: 'messy',      label: 'Messy common areas' },
];

const INTEREST_CATEGORIES = [
  { key: 'fitness', label: '🏃 Fitness', options: ['Running', 'Yoga', 'Gym', 'Hiking', 'Swimming', 'Cycling', 'Rock Climbing'] },
  { key: 'food',    label: '🍕 Food & Drink', options: ['Cooking', 'Baking', 'Coffee', 'Wine & Cocktails', 'Foodie Adventures', 'Meal Prep'] },
  { key: 'arts',    label: '🎨 Arts & Culture', options: ['Movies', 'Music', 'Reading', 'Photography', 'Art Galleries', 'Theater'] },
  { key: 'outdoors', label: '🌿 Outdoors', options: ['Camping', 'Travel', 'Beach', 'Gardening', 'Road Trips', 'Surfing'] },
  { key: 'tech',    label: '🎮 Tech & Gaming', options: ['Gaming', 'Coding', 'Podcasts', 'Anime', 'Board Games', 'VR / AR'] },
];

const PROMPTS = [
  'My ideal Saturday morning looks like…',
  "I'm looking for a roommate who…",
  "Don't room with me if you hate…",
  'My morning routine is…',
  "On weeknights you'll find me…",
  'Weekends are for…',
  'I clean the apartment…',
  'My noise level is…',
  'Overnight guests are…',
  'My kitchen rule is…',
  'My sleep schedule is…',
  "I've lived with roommates before and learned…",
  'A quirk about living with me…',
  'My ideal apartment vibe…',
  'After work I usually…',
  'The best thing about me as a roommate…',
];

const MAX_LISTING_PHOTOS = 6;
type ListingPhotoItem = { kind: 'path'; path: string; url: string } | { kind: 'local'; uri: string };

/** Light theme: shadcn-style neutrals + RoomPear pear green accents. */
const theme = {
  background: '#FFFFFF',
  foreground: '#252525',
  muted: '#ECECF0',
  mutedForeground: '#717182',
  primary: '#030213',
  primaryForeground: '#FFFFFF',
  accent: '#E9EBEF',
  accentForeground: '#030213',
  border: 'rgba(0, 0, 0, 0.1)',
  destructive: '#D4183D',
  inputBackground: '#F3F3F5',
  radiusLg: 12,
  radiusMd: 10,
  /** Base gradient keys (screen uses multi-stop green → white) */
  pear: '#C8D8CA',
  pearMuted: '#E4EDE6',
  pearDark: '#5A6B5D',
  pearForeground: '#FFFFFF',
};

type DealbreakerLevel = 'hard' | 'soft' | 'none';
type PromptEntry = { question: string; answer: string };

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/MainTabNavigator';

type Props = BottomTabScreenProps<MainTabParamList, 'Profile'>;

export default function UserProfileScreen({ route }: Props) {
  const onDevShowOnboarding = route.params?.onDevShowOnboarding;
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editPhotosOpen, setEditPhotosOpen] = useState(false);
  const [editPrefsOpen, setEditPrefsOpen] = useState(false);
  const [editPromptsOpen, setEditPromptsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingPrompts, setSavingPrompts] = useState(false);

  const [referralDraft, setReferralDraft] = useState('');
  const [referralBusy, setReferralBusy] = useState(false);

  // Edit preferences state
  const [editInterests, setEditInterests] = useState<Record<string, string[]>>({});
  const [editDealbreakers, setEditDealbreakers] = useState<Record<string, DealbreakerLevel>>({});
  const [expandedPrefCat, setExpandedPrefCat] = useState<string | null>('fitness');

  // Edit prompts state
  const [editPrompts, setEditPrompts] = useState<PromptEntry[]>([]);
  const [promptPickerIndex, setPromptPickerIndex] = useState<number | null>(null);

  // Listing state
  const [listing, setListing] = useState<Listing | null>(null);
  const [listingOpen, setListingOpen] = useState(false);
  const [savingListing, setSavingListing] = useState(false);
  const [editRent, setEditRent] = useState('');
  const [editRoomType, setEditRoomType] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editListingCity, setEditListingCity] = useState('');
  const [editListingState, setEditListingState] = useState('');
  const [editListingZip, setEditListingZip] = useState('');
  const [editMoveInDate, setEditMoveInDate] = useState('');
  const [editListingPhotos, setEditListingPhotos] = useState<ListingPhotoItem[]>([]);

  const [editName, setEditName] = useState('');

  const loadListing = useCallback(async (userId: string) => {
    const l = await getListing(userId);
    setListing(l);
  }, []);

  const openListingModal = async () => {
    setEditRent(listing?.rent != null ? String(listing.rent) : '');
    setEditRoomType(listing?.room_type ?? '');
    setEditAddress(listing?.address ?? '');
    setEditListingCity(listing?.city ?? '');
    setEditListingState(listing?.state ?? '');
    setEditListingZip(listing?.zip_code ?? '');
    setEditMoveInDate(listing?.move_in_date ?? '');
    const paths = listing?.listing_photos ?? [];
    const items: ListingPhotoItem[] = await Promise.all(
      paths.map(async (path) => {
        const url = await getProfileImageUrl(path);
        return { kind: 'path' as const, path, url: url ?? '' };
      })
    );
    setEditListingPhotos(items);
    setListingOpen(true);
  };

  const handleAddListingPhoto = async () => {
    if (editListingPhotos.length >= MAX_LISTING_PHOTOS) return;
    const uri = await pickListingImage();
    if (!uri) return;
    setEditListingPhotos((prev) => [...prev, { kind: 'local', uri }]);
  };

  const handleSaveListing = async () => {
    if (!user) return;
    setSavingListing(true);
    try {
      const photoPaths: string[] = [];
      for (const item of editListingPhotos) {
        if (item.kind === 'path') {
          photoPaths.push(item.path);
        } else {
          const { path, error } = await uploadListingPhoto(user.id, item.uri);
          if (error || !path) { Alert.alert('Error', error ?? 'Photo upload failed'); return; }
          photoPaths.push(path);
        }
      }
      const result = await saveListing(user.id, {
        rent: editRent ? parseFloat(editRent) : null,
        room_type: editRoomType.trim() || null,
        address: editAddress.trim() || null,
        city: editListingCity.trim() || null,
        state: editListingState.trim() || null,
        zip_code: editListingZip.trim() || null,
        move_in_date: editMoveInDate.trim() || null,
        listing_photos: photoPaths,
      });
      if (!result.ok) { Alert.alert('Error', result.error); return; }
      setListingOpen(false);
      await loadListing(user.id);
      await loadProfile(user.id);
    } finally {
      setSavingListing(false);
    }
  };

  const handleDeleteListing = () => {
    if (!user) return;
    Alert.alert('Remove listing', 'Remove your place listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await deleteListing(user.id);
          setListing(null);
          await loadProfile(user.id);
        },
      },
    ]);
  };

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    setProfile(data);

    const paths = profilePhotoPathsFromRow(data?.profile_photo_url);
    setPhotoPaths(paths);

    if (data?.profile_photo_url) {
      const signedUrls = await getProfileImageUrls(data.profile_photo_url);
      setImageUrls(signedUrls ?? []);
    } else {
      setImageUrls([]);
    }

    const p = await getPreferences(userId);
    setPrefs(p);
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email } : null);
      if (u) { loadProfile(u.id); loadListing(u.id); }
      else {
        setProfile(null);
        setPrefs(null);
        setImageUrls([]);
        setPhotoPaths([]);
        setListing(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile, loadListing]);

  const openEditName = () => {
    if (!profile) return;
    setEditName(profile.name?.trim() ?? '');
    setEditNameOpen(true);
  };

  const handleSaveName = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editName.trim() || profile?.name,
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      setEditNameOpen(false);
      await loadProfile(user.id);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddPhoto = async () => {
    if (!user) return;
    if (photoPaths.length >= MAX_PROFILE_PHOTOS) {
      Alert.alert('Photos', `You can have up to ${MAX_PROFILE_PHOTOS} photos.`);
      return;
    }
    const uri = await pickImage();
    if (!uri) return;

    setSavingPhotos(true);
    try {
      const result = await appendProfilePhoto(user.id, uri);
      if (!result.ok) {
        Alert.alert('Upload failed', result.error ?? 'Unknown error');
        return;
      }
      await loadProfile(user.id);
    } finally {
      setSavingPhotos(false);
    }
  };

  const handleReplacePhoto = async (index: number) => {
    if (!user) return;
    const uri = await pickImage();
    if (!uri) return;
    setSavingPhotos(true);
    try {
      const result = await replaceProfilePhotoAt(user.id, index, uri);
      if (!result.ok) {
        Alert.alert('Replace failed', result.error ?? 'Error');
        return;
      }
      await loadProfile(user.id);
    } finally {
      setSavingPhotos(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    if (!user) return;

    Alert.alert('Edit photo', 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Replace',
        onPress: () => handleReplacePhoto(index),
      },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSavingPhotos(true);
          try {
            const result = await removeProfilePhotoAt(user.id, index);
            if (!result.ok) {
              Alert.alert('Cannot remove', result.error ?? 'Error');
              return;
            }
            await loadProfile(user.id);
          } finally {
            setSavingPhotos(false);
          }
        },
      },
    ]);
  };

  const openEditPrefs = () => {
    const defaultDB = Object.fromEntries(DEALBREAKER_ITEMS.map((d) => [d.key, 'none' as DealbreakerLevel]));
    setEditInterests(prefs?.interests ?? {});
    setEditDealbreakers({ ...defaultDB, ...(prefs?.dealbreakers ?? {}) });
    setExpandedPrefCat('fitness');
    setEditPrefsOpen(true);
  };

  const handleSavePrefs = async () => {
    if (!user) return;
    setSavingPrefs(true);
    try {
      await savePreferences(user.id, { interests: editInterests, dealbreakers: editDealbreakers });
      setEditPrefsOpen(false);
      const p = await getPreferences(user.id);
      setPrefs(p);
    } finally {
      setSavingPrefs(false);
    }
  };

  const openEditPrompts = () => {
    const current: PromptEntry[] = Array.isArray(profile?.prompts) ? [...profile.prompts] : [];
    setEditPrompts(current.length > 0 ? current : [{ question: '', answer: '' }]);
    setPromptPickerIndex(null);
    setEditPromptsOpen(true);
  };

  const handleSavePrompts = async () => {
    if (!user) return;
    setSavingPrompts(true);
    try {
      const filtered = editPrompts.filter((p) => p.question && p.answer.trim());
      await supabase.from('profiles').update({ prompts: filtered }).eq('id', user.id);
      setEditPromptsOpen(false);
      await loadProfile(user.id);
    } finally {
      setSavingPrompts(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error', error.message);
  };

  const handleCopyReferralCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      Alert.alert('Copied', 'Your referral code is on the clipboard.');
    } catch {
      Alert.alert('Copy failed', 'Could not copy to clipboard.');
    }
  };

  const afterCloseSettings = (fn: () => void) => {
    setSettingsOpen(false);
    setTimeout(fn, 280);
  };

  const handleApplyReferralCode = async () => {
    const code = referralDraft.trim().toUpperCase();
    if (code.length < 4) {
      Alert.alert('Referral code', 'Enter a valid code (at least 4 characters).');
      return;
    }
    setReferralBusy(true);
    try {
      const result = await redeemReferralCode(code);
      if (result.success) {
        setReferralDraft('');
        Alert.alert(
          'Referral applied',
          'You and your friend each earned a bonus reveal for Likes.'
        );
        if (user) await loadProfile(user.id);
      } else {
        Alert.alert('Referral', redeemErrorMessage(result.error));
      }
    } finally {
      setReferralBusy(false);
    }
  };

  const displayName = profile?.name?.trim() || '';
  const displayAge =
    typeof profile?.age === 'number' && !Number.isNaN(profile.age)
      ? profile.age
      : null;

  return (
    <View style={styles.container}>
      {/* Mossy green at top → airy white at bottom (iOS settings–style wash) */}
      <LinearGradient
        colors={['#1A3329', '#2D4F42', '#5A806B', '#9CB8A8', '#D8E8DF', '#F5FAF7', '#FFFFFF']}
        locations={[0, 0.06, 0.14, 0.28, 0.48, 0.72, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft blobs — read through the frosted blur for depth */}
      <View style={styles.blobLayer} pointerEvents="none">
        <View style={[styles.blob, styles.blobA]} />
        <View style={[styles.blob, styles.blobB]} />
        <View style={[styles.blob, styles.blobC]} />
        <View style={[styles.blob, styles.blobD]} />
        <View style={[styles.blob, styles.blobE]} />
      </View>
      {/* iOS system material frosts gradient + blobs together */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 52 : 34}
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : 'light'}
        {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
        style={[StyleSheet.absoluteFill, styles.fullScreenBlur]}
        pointerEvents="none"
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 12 + insets.top,
            paddingBottom: 32 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {user && (
          <>
            <View style={styles.headerRow}>
              <View style={styles.headerTitleBlock}>
                <Text style={styles.titleOnGreen}>Profile</Text>
                <Text style={styles.taglineOnGreen}>Preview how roommates see you</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open settings"
                onPress={() => setSettingsOpen(true)}
                style={({ pressed }) => [styles.settingsBtn, pressed && styles.settingsBtnPressed]}
              >
                <Ionicons name="settings-outline" size={24} color="rgba(255,255,255,0.95)" />
              </Pressable>
            </View>

            <BlurView
              intensity={Platform.OS === 'ios' ? 38 : 28}
              tint={Platform.OS === 'ios' ? 'systemThinMaterialLight' : 'light'}
              {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
              style={styles.glassPanel}
            >
              <PublicProfileCard
                imageUrls={imageUrls}
                name={displayName}
                age={displayAge}
                location={formatLocationLine(prefs)}
                bio=""
                hobbies={[]}
              />

              <Text style={styles.quickSectionLabel}>Edit Photos & personality</Text>
              <View style={styles.quickGrid}>
                <TouchableOpacity
                  style={styles.quickTile}
                  onPress={() => setEditPhotosOpen(true)}
                  activeOpacity={0.85}
                >
                  <View style={styles.quickTileIconWrap}>
                    <Ionicons name="images-outline" size={22} color={theme.foreground} />
                  </View>
                  <Text style={styles.quickTileLabel}>Photos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickTile}
                  onPress={openEditPrefs}
                  activeOpacity={0.85}
                >
                  <View style={styles.quickTileIconWrap}>
                    <Ionicons name="heart-outline" size={22} color={theme.foreground} />
                  </View>
                  <Text style={styles.quickTileLabel}>Interests</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickTile}
                  onPress={openEditPrompts}
                  activeOpacity={0.85}
                >
                  <View style={styles.quickTileIconWrap}>
                    <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.foreground} />
                  </View>
                  <Text style={styles.quickTileLabel}>Prompts</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </>
        )}
      </ScrollView>

      {/* Settings hub: deep links into existing flows + future sections */}
      <Modal
        visible={settingsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={styles.settingsModalRoot}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSettingsOpen(false)}>
              <Text style={styles.modalCancel}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Settings</Text>
            <View style={{ width: 56 }} />
          </View>
          <ScrollView
            style={styles.settingsScroll}
            contentContainerStyle={styles.settingsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.settingsSectionLabel}>Your profile</Text>
            <View style={styles.settingsGroup}>
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={() => afterCloseSettings(() => openEditName())}
              >
                <View style={styles.settingsRowLeft}>
                  <Ionicons name="person-outline" size={20} color={theme.foreground} />
                  <Text style={styles.settingsRowTitle}>Display name</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
              </TouchableOpacity>
              <View style={styles.settingsRowDivider} />
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={() => afterCloseSettings(() => setEditPhotosOpen(true))}
              >
                <View style={styles.settingsRowLeft}>
                  <Ionicons name="images-outline" size={20} color={theme.foreground} />
                  <Text style={styles.settingsRowTitle}>Photos</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
              </TouchableOpacity>
              <View style={styles.settingsRowDivider} />
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={() => afterCloseSettings(() => openEditPrefs())}
              >
                <View style={styles.settingsRowLeft}>
                  <Ionicons name="heart-outline" size={20} color={theme.foreground} />
                  <Text style={styles.settingsRowTitle}>Interests & dealbreakers</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
              </TouchableOpacity>
              <View style={styles.settingsRowDivider} />
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={() => afterCloseSettings(() => openEditPrompts())}
              >
                <View style={styles.settingsRowLeft}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.foreground} />
                  <Text style={styles.settingsRowTitle}>Personality prompts</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={styles.settingsSectionLabel}>Your place</Text>
            <View style={styles.settingsGroup}>
              {listing ? (
                <>
                  <View style={styles.settingsListingSummary}>
                    <Text style={styles.settingsListingTitle}>
                      {listing.room_type ?? 'Room'}
                      {listing.city ? ` · ${listing.city}${listing.state ? `, ${listing.state}` : ''}` : ''}
                    </Text>
                    {listing.rent != null && (
                      <Text style={styles.settingsListingMeta}>${listing.rent}/mo</Text>
                    )}
                    {listing.move_in_date ? (
                      <Text style={styles.settingsListingSub}>Available {listing.move_in_date}</Text>
                    ) : null}
                  </View>
                  <View style={styles.settingsRowDivider} />
                  <TouchableOpacity
                    style={styles.settingsRow}
                    onPress={() => afterCloseSettings(() => openListingModal())}
                  >
                    <View style={styles.settingsRowLeft}>
                      <Ionicons name="create-outline" size={20} color={theme.foreground} />
                      <Text style={styles.settingsRowTitle}>Edit listing</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
                  </TouchableOpacity>
                  <View style={styles.settingsRowDivider} />
                  <TouchableOpacity style={styles.settingsRow} onPress={handleDeleteListing}>
                    <View style={styles.settingsRowLeft}>
                      <Ionicons name="trash-outline" size={20} color={theme.destructive} />
                      <Text style={[styles.settingsRowTitle, { color: theme.destructive }]}>Remove listing</Text>
                    </View>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.settingsRow}
                  onPress={() => afterCloseSettings(() => openListingModal())}
                >
                  <View style={styles.settingsRowLeft}>
                    <Ionicons name="home-outline" size={20} color={theme.foreground} />
                    <Text style={styles.settingsRowTitle}>Add a place listing</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.settingsSectionLabel}>Invite friends</Text>
            <View style={styles.settingsGroup}>
              <Text style={styles.settingsInviteHelp}>
                Share your code. When a friend joins and applies it, you both get +1 bonus reveal on Likes.
              </Text>
              {profile?.referral_code ? (
                <View style={styles.referralCodeRow}>
                  <Text style={styles.referralCodeText}>{profile.referral_code}</Text>
                  <TouchableOpacity
                    style={styles.referralCopyBtn}
                    onPress={() => handleCopyReferralCode(profile.referral_code as string)}
                  >
                    <Text style={styles.referralCopyBtnText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {!profile?.referred_by_user_id ? (
                <>
                  <Text style={styles.inviteLabel}>Have a friend&apos;s code?</Text>
                  <TextInput
                    style={styles.referralInput}
                    placeholder="Enter code"
                    placeholderTextColor={theme.mutedForeground}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    value={referralDraft}
                    onChangeText={(t) => setReferralDraft(t.toUpperCase())}
                    editable={!referralBusy}
                  />
                  <TouchableOpacity
                    style={[styles.referralApplyBtn, referralBusy && styles.referralApplyBtnDim]}
                    onPress={handleApplyReferralCode}
                    disabled={referralBusy}
                  >
                    {referralBusy ? (
                      <ActivityIndicator color={theme.primaryForeground} />
                    ) : (
                      <Text style={styles.referralApplyBtnText}>Apply code</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.inviteLinked}>You joined with a friend&apos;s referral.</Text>
              )}
            </View>

            <Text style={styles.settingsSectionLabel}>Account</Text>
            <View style={styles.settingsGroup}>
              {user?.email ? (
                <>
                  <View style={styles.settingsInfoRow}>
                    <Text style={styles.settingsInfoLabel}>Email</Text>
                    <Text style={styles.settingsInfoValue}>{user.email}</Text>
                  </View>
                  <View style={styles.settingsRowDivider} />
                </>
              ) : null}
              {profile?.phone ? (
                <>
                  <View style={styles.settingsInfoRow}>
                    <Text style={styles.settingsInfoLabel}>Phone</Text>
                    <Text style={styles.settingsInfoValue}>{profile.phone}</Text>
                  </View>
                  <View style={styles.settingsRowDivider} />
                </>
              ) : null}
              <View style={styles.settingsInfoRow}>
                <Text style={styles.settingsInfoLabel}>Plan</Text>
                <Text style={styles.settingsInfoValue}>
                  {(profile?.subscription_tier as string) || 'free'}
                </Text>
              </View>
            </View>

            <Text style={styles.settingsSectionLabel}>More</Text>
            <View style={styles.settingsGroup}>
              <View style={styles.settingsPlaceholderRow}>
                <View style={styles.settingsRowLeft}>
                  <Ionicons name="notifications-outline" size={20} color={theme.mutedForeground} />
                  <Text style={styles.settingsPlaceholderTitle}>Notifications</Text>
                </View>
                <Text style={styles.soonBadge}>Soon</Text>
              </View>
              <View style={styles.settingsRowDivider} />
              <View style={styles.settingsPlaceholderRow}>
                <View style={styles.settingsRowLeft}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={theme.mutedForeground} />
                  <Text style={styles.settingsPlaceholderTitle}>Privacy & safety</Text>
                </View>
                <Text style={styles.soonBadge}>Soon</Text>
              </View>
              <View style={styles.settingsRowDivider} />
              <View style={styles.settingsPlaceholderRow}>
                <View style={styles.settingsRowLeft}>
                  <Ionicons name="card-outline" size={20} color={theme.mutedForeground} />
                  <Text style={styles.settingsPlaceholderTitle}>Subscription & billing</Text>
                </View>
                <Text style={styles.soonBadge}>Soon</Text>
              </View>
              <View style={styles.settingsRowDivider} />
              <View style={styles.settingsPlaceholderRow}>
                <View style={styles.settingsRowLeft}>
                  <Ionicons name="help-circle-outline" size={20} color={theme.mutedForeground} />
                  <Text style={styles.settingsPlaceholderTitle}>Help & support</Text>
                </View>
                <Text style={styles.soonBadge}>Soon</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Text style={styles.signOutButtonText}>Sign out</Text>
            </TouchableOpacity>
            {__DEV__ && onDevShowOnboarding && (
              <TouchableOpacity style={styles.devButton} onPress={onDevShowOnboarding}>
                <Text style={styles.devButtonText}>DEV: Preview Onboarding</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={editNameOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditNameOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditNameOpen(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Display name</Text>
            <TouchableOpacity onPress={handleSaveName} disabled={savingProfile}>
              {savingProfile ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.nameFieldLabel}>Name</Text>
            <TextInput
              style={styles.nameInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={theme.mutedForeground}
              autoCapitalize="words"
            />
            <Text style={styles.nameFieldHint}>
              City and location come from your housing preferences (set during onboarding).
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit preferences modal (interests + dealbreakers) ── */}
      <Modal
        visible={editPrefsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditPrefsOpen(false)}
      >
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditPrefsOpen(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Interests & Dealbreakers</Text>
            <TouchableOpacity onPress={handleSavePrefs} disabled={savingPrefs}>
              {savingPrefs ? <ActivityIndicator color={theme.primary} /> : <Text style={styles.modalSave}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            {/* Interests */}
            <Text style={styles.prefSectionTitle}>Interests</Text>
            <Text style={styles.prefSectionSub}>Select up to 5 per category</Text>
            {INTEREST_CATEGORIES.map((cat) => {
              const selected = editInterests[cat.key] ?? [];
              const isExpanded = expandedPrefCat === cat.key;
              return (
                <View key={cat.key} style={styles.catBlock}>
                  <TouchableOpacity style={styles.catHeader} onPress={() => setExpandedPrefCat(isExpanded ? null : cat.key)}>
                    <Text style={styles.catLabel}>{cat.label} {selected.length > 0 ? `(${selected.length})` : ''}</Text>
                    <Text style={styles.catChevron}>{isExpanded ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.chipsWrap}>
                      {cat.options.map((opt) => {
                        const on = selected.includes(opt);
                        const disabled = !on && selected.length >= 5;
                        return (
                          <TouchableOpacity
                            key={opt}
                            style={[styles.chip, on && styles.chipOn, disabled && styles.chipDim]}
                            disabled={disabled}
                            onPress={() => {
                              setEditInterests((prev) => {
                                const cur = prev[cat.key] ?? [];
                                return { ...prev, [cat.key]: on ? cur.filter((x) => x !== opt) : [...cur, opt] };
                              });
                            }}
                          >
                            <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Dealbreakers */}
            <Text style={[styles.prefSectionTitle, { marginTop: 24 }]}>Dealbreakers</Text>
            <Text style={styles.prefSectionSub}>Hard = never · Soft = prefer not · None = fine</Text>
            {DEALBREAKER_ITEMS.map((item) => {
              const val = editDealbreakers[item.key] ?? 'none';
              return (
                <View key={item.key} style={styles.dbRow}>
                  <Text style={styles.dbLabel}>{item.label}</Text>
                  <View style={styles.dbBtns}>
                    {(['hard', 'soft', 'none'] as DealbreakerLevel[]).map((lvl) => (
                      <TouchableOpacity
                        key={lvl}
                        style={[styles.dbBtn, val === lvl && (lvl === 'hard' ? styles.dbBtnHard : lvl === 'soft' ? styles.dbBtnSoft : styles.dbBtnNone)]}
                        onPress={() => setEditDealbreakers((prev) => ({ ...prev, [item.key]: lvl }))}
                      >
                        <Text style={[styles.dbBtnText, val === lvl && styles.dbBtnTextActive]}>
                          {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit prompts modal ── */}
      <Modal
        visible={editPromptsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditPromptsOpen(false)}
      >
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditPromptsOpen(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Prompts</Text>
            <TouchableOpacity onPress={handleSavePrompts} disabled={savingPrompts}>
              {savingPrompts ? <ActivityIndicator color={theme.primary} /> : <Text style={styles.modalSave}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.prefSectionSub}>Pick up to 3 prompts and answer them.</Text>

            {editPrompts.map((entry, idx) => (
              <View key={idx} style={styles.promptBlock}>
                {/* Prompt picker */}
                {promptPickerIndex === idx ? (
                  <View style={styles.promptPickerList}>
                    {PROMPTS.filter((p) => !editPrompts.some((e, i) => i !== idx && e.question === p)).map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={styles.promptPickerItem}
                        onPress={() => {
                          setEditPrompts((prev) => prev.map((e, i) => i === idx ? { ...e, question: p } : e));
                          setPromptPickerIndex(null);
                        }}
                      >
                        <Text style={styles.promptPickerText}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity style={styles.promptQuestion} onPress={() => setPromptPickerIndex(idx)}>
                    <Text style={[styles.promptQuestionText, !entry.question && styles.promptQuestionPlaceholder]}>
                      {entry.question || 'Tap to choose a prompt…'}
                    </Text>
                    <Text style={styles.promptQuestionEdit}>✎</Text>
                  </TouchableOpacity>
                )}

                {/* Answer input */}
                <TextInput
                  style={styles.promptAnswerInput}
                  value={entry.answer}
                  onChangeText={(t) => setEditPrompts((prev) => prev.map((e, i) => i === idx ? { ...e, answer: t } : e))}
                  placeholder="Your answer…"
                  placeholderTextColor="#9AA"
                  multiline
                  maxLength={300}
                />

                {/* Remove */}
                <TouchableOpacity onPress={() => setEditPrompts((prev) => prev.filter((_, i) => i !== idx))}>
                  <Text style={styles.promptRemove}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            {editPrompts.length < 3 && (
              <TouchableOpacity
                style={styles.addPromptBtn}
                onPress={() => setEditPrompts((prev) => [...prev, { question: '', answer: '' }])}
              >
                <Text style={styles.addPromptBtnText}>+ Add prompt</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={editPhotosOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditPhotosOpen(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditPhotosOpen(false)}>
              <Text style={styles.modalCancel}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Photos</Text>
            <View style={{ width: 48 }} />
          </View>
          <ScrollView contentContainerStyle={styles.photosModalContent}>
            <Text style={styles.photosHelp}>
              First photo is your cover. Swipe on your profile card to see the rest. Keep 3–5 photos.
            </Text>
            {savingPhotos ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={theme.primary} />
            ) : null}
            <View style={styles.photoList}>
              {imageUrls.map((url, index) => (
                <View key={url + index} style={styles.photoRow}>
                  <Image source={{ uri: url }} style={styles.photoRowImage} />
                  <View style={styles.photoRowMeta}>
                    <Text style={styles.photoRowLabel}>
                      {index === 0 ? 'Cover photo' : `Photo ${index + 1}`}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemovePhoto(index)}
                      disabled={savingPhotos}
                    >
                      <Text style={styles.photoRemoveLink}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[
                styles.addPhotoBtn,
                photoPaths.length >= MAX_PROFILE_PHOTOS && styles.addPhotoBtnDisabled,
              ]}
              onPress={handleAddPhoto}
              disabled={savingPhotos || photoPaths.length >= MAX_PROFILE_PHOTOS}
            >
              <Text style={styles.addPhotoBtnText}>
                {photoPaths.length >= MAX_PROFILE_PHOTOS
                  ? `Maximum ${MAX_PROFILE_PHOTOS} photos`
                  : '+ Add photo'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Listing modal ── */}
      <Modal
        visible={listingOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setListingOpen(false)}
      >
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setListingOpen(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{listing ? 'Edit Listing' : 'Add Listing'}</Text>
            <TouchableOpacity onPress={handleSaveListing} disabled={savingListing}>
              {savingListing ? <ActivityIndicator color={theme.primary} /> : <Text style={styles.modalSave}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">

            <Text style={styles.listingFieldLabel}>Photos ({editListingPhotos.length}/{MAX_LISTING_PHOTOS})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                {editListingPhotos.map((item, idx) => (
                  <View key={idx} style={{ position: 'relative' }}>
                    <Image
                      source={{ uri: item.kind === 'path' ? item.url : item.uri }}
                      style={{ width: 110, height: 82, borderRadius: 8, backgroundColor: '#ddd' }}
                    />
                    <TouchableOpacity
                      style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => setEditListingPhotos((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Text style={{ color: '#fff', fontSize: 13, lineHeight: 18 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {editListingPhotos.length < MAX_LISTING_PHOTOS && (
                  <TouchableOpacity
                    style={{ width: 110, height: 82, borderRadius: 8, borderWidth: 1.5, borderColor: theme.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}
                    onPress={handleAddListingPhoto}
                  >
                    <Text style={{ color: theme.mutedForeground, fontSize: 26, lineHeight: 30 }}>+</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>

            <Text style={styles.listingFieldLabel}>Monthly Rent ($)</Text>
            <TextInput
              style={styles.listingInput}
              value={editRent}
              onChangeText={setEditRent}
              placeholder="e.g. 1200"
              placeholderTextColor="#9AA"
              keyboardType="numeric"
            />

            <Text style={styles.listingFieldLabel}>Room Type</Text>
            <View style={styles.chipsWrap}>
              {[
                { label: 'Private room', value: 'private' },
                { label: 'Shared room', value: 'shared' },
                { label: 'Studio', value: 'studio' },
                { label: 'Entire place', value: 'entire' },
              ].map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.chip, editRoomType === t.value && styles.chipOn]}
                  onPress={() => setEditRoomType(t.value)}
                >
                  <Text style={[styles.chipText, editRoomType === t.value && styles.chipTextOn]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.listingFieldLabel}>City</Text>
            <TextInput
              style={styles.listingInput}
              value={editListingCity}
              onChangeText={setEditListingCity}
              placeholder="e.g. Riverside"
              placeholderTextColor="#9AA"
            />

            <Text style={styles.listingFieldLabel}>State</Text>
            <TextInput
              style={styles.listingInput}
              value={editListingState}
              onChangeText={setEditListingState}
              placeholder="e.g. CA"
              placeholderTextColor="#9AA"
              autoCapitalize="characters"
              maxLength={2}
            />

            <Text style={styles.listingFieldLabel}>Address (optional)</Text>
            <TextInput
              style={styles.listingInput}
              value={editAddress}
              onChangeText={setEditAddress}
              placeholder="Street address"
              placeholderTextColor="#9AA"
            />

            <Text style={styles.listingFieldLabel}>Available From</Text>
            <TextInput
              style={styles.listingInput}
              value={editMoveInDate}
              onChangeText={setEditMoveInDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9AA"
            />

          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 0,
  },
  fullScreenBlur: {
    zIndex: 0,
  },
  blobLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
  },
  blobA: {
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(110, 210, 165, 0.42)',
    top: -120,
    left: -100,
    transform: [{ scaleX: 1.15 }],
  },
  blobB: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    top: 40,
    right: -70,
    transform: [{ scaleY: 1.1 }],
  },
  blobC: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(45, 120, 95, 0.35)',
    top: 160,
    left: -60,
  },
  blobD: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(160, 230, 195, 0.28)',
    bottom: -40,
    right: -80,
    transform: [{ rotate: '18deg' }],
  },
  blobE: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    bottom: 120,
    left: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  glassPanel: {
    marginHorizontal: 16,
    marginTop: -6,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#1A2C24',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 8,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.38)',
  },
  settingsBtnPressed: {
    opacity: 0.72,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: theme.foreground,
    letterSpacing: -0.5,
  },
  titleOnGreen: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tagline: {
    fontSize: 13,
    color: theme.mutedForeground,
    marginTop: 2,
  },
  taglineOnGreen: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  nameFieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.foreground,
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: theme.inputBackground,
    borderRadius: theme.radiusMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.foreground,
  },
  nameFieldHint: {
    fontSize: 13,
    color: theme.mutedForeground,
    marginTop: 14,
    lineHeight: 19,
  },
  quickSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 10,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  quickTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    backgroundColor: theme.inputBackground,
    borderRadius: theme.radiusLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  quickTileIconWrap: {
    marginBottom: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  quickTileLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.foreground,
    textAlign: 'center',
  },
  settingsModalRoot: {
    flex: 1,
    backgroundColor: theme.background,
    paddingTop: 8,
  },
  settingsScroll: {
    flex: 1,
  },
  settingsScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  settingsSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    marginTop: 22,
    marginBottom: 8,
  },
  settingsGroup: {
    backgroundColor: theme.muted,
    borderRadius: theme.radiusLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    overflow: 'hidden',
    paddingVertical: 4,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingsRowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.foreground,
  },
  settingsRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.border,
    marginLeft: 32,
  },
  settingsListingSummary: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  settingsListingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.foreground,
  },
  settingsListingMeta: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.foreground,
    marginTop: 4,
  },
  settingsListingSub: {
    fontSize: 13,
    color: theme.mutedForeground,
    marginTop: 4,
  },
  settingsInfoRow: {
    paddingVertical: 10,
  },
  settingsInfoLabel: {
    fontSize: 12,
    color: theme.mutedForeground,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  settingsInfoValue: {
    fontSize: 16,
    color: theme.foreground,
  },
  settingsInviteHelp: {
    fontSize: 14,
    color: theme.mutedForeground,
    lineHeight: 20,
    marginBottom: 12,
    marginTop: 4,
  },
  settingsPlaceholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingsPlaceholderTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.mutedForeground,
  },
  soonBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.mutedForeground,
    backgroundColor: theme.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  referralCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.background,
    borderRadius: theme.radiusMd,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    marginBottom: 16,
  },
  referralCodeText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    color: theme.foreground,
  },
  referralCopyBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radiusMd,
  },
  referralCopyBtnText: {
    color: theme.primaryForeground,
    fontWeight: '700',
    fontSize: 14,
  },
  inviteLabel: {
    fontSize: 12,
    color: theme.mutedForeground,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  referralInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    backgroundColor: theme.background,
    borderRadius: theme.radiusMd,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: theme.foreground,
    marginBottom: 10,
  },
  referralApplyBtn: {
    backgroundColor: theme.primary,
    borderRadius: theme.radiusMd,
    paddingVertical: 14,
    alignItems: 'center',
  },
  referralApplyBtnDim: {
    opacity: 0.65,
  },
  referralApplyBtnText: {
    color: theme.primaryForeground,
    fontWeight: '700',
    fontSize: 16,
  },
  inviteLinked: {
    fontSize: 14,
    color: theme.mutedForeground,
    fontWeight: '600',
  },
  signOutButton: {
    marginTop: 16,
    backgroundColor: theme.muted,
    borderRadius: theme.radiusMd,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  signOutButtonText: {
    color: theme.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: theme.background,
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.foreground,
  },
  modalCancel: {
    fontSize: 17,
    color: theme.mutedForeground,
    width: 72,
  },
  modalSave: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.foreground,
    width: 72,
    textAlign: 'right',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  photosModalContent: {
    padding: 20,
    paddingBottom: 40,
  },
  photosHelp: {
    fontSize: 14,
    color: theme.mutedForeground,
    marginBottom: 16,
    lineHeight: 20,
  },
  photoList: {
    width: '100%',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: theme.inputBackground,
    borderRadius: 12,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  photoRowImage: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#D9E1E6',
  },
  photoRowMeta: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  photoRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.foreground,
    marginBottom: 6,
  },
  photoRemoveLink: {
    fontSize: 15,
    color: '#E85D4C',
    fontWeight: '600',
  },
  addPhotoBtn: {
    marginTop: 20,
    backgroundColor: theme.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addPhotoBtnDisabled: {
    opacity: 0.5,
  },
  addPhotoBtnText: {
    color: theme.primaryForeground,
    fontSize: 16,
    fontWeight: '600',
  },
  devButton: {
    marginTop: 12,
    backgroundColor: '#FF6B00',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  devButtonText: {
    color: '#FDFDFD',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Interests & dealbreakers modal ──────────────────────────────────────────
  prefSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.foreground,
    marginBottom: 4,
  },
  prefSectionSub: {
    fontSize: 13,
    color: theme.mutedForeground,
    marginBottom: 16,
  },
  catBlock: {
    marginBottom: 8,
    backgroundColor: '#F4F7F9',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  catLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.foreground,
  },
  catChevron: {
    fontSize: 12,
    color: theme.mutedForeground,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FDFDFD',
    borderWidth: 1.5,
    borderColor: '#D9E1E6',
  },
  chipOn: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  chipDim: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.mutedForeground,
  },
  chipTextOn: {
    color: theme.primaryForeground,
  },
  dbRow: {
    marginBottom: 14,
  },
  dbLabel: {
    fontSize: 15,
    color: theme.foreground,
    fontWeight: '500',
    marginBottom: 8,
  },
  dbBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  dbBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F4F7F9',
    borderWidth: 1.5,
    borderColor: '#D9E1E6',
  },
  dbBtnHard: {
    backgroundColor: '#FFF0EE',
    borderColor: '#E53935',
  },
  dbBtnSoft: {
    backgroundColor: '#FFF8E1',
    borderColor: '#F59E0B',
  },
  dbBtnNone: {
    backgroundColor: theme.muted,
    borderColor: theme.border,
  },
  dbBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.mutedForeground,
  },
  dbBtnTextActive: {
    color: theme.foreground,
  },

  // ── Prompts modal ────────────────────────────────────────────────────────────
  promptBlock: {
    backgroundColor: '#F4F7F9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  promptPickerList: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: '#FDFDFD',
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  promptPickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D9E1E6',
  },
  promptPickerText: {
    fontSize: 14,
    color: theme.foreground,
  },
  promptQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D9E1E6',
  },
  promptQuestionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: theme.foreground,
    lineHeight: 20,
  },
  promptQuestionPlaceholder: {
    color: '#9AA',
    fontWeight: '400',
  },
  promptQuestionEdit: {
    fontSize: 16,
    color: theme.mutedForeground,
    marginLeft: 8,
  },
  promptAnswerInput: {
    fontSize: 15,
    color: theme.foreground,
    minHeight: 60,
    maxHeight: 120,
    paddingVertical: 4,
    paddingHorizontal: 0,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  promptRemove: {
    fontSize: 13,
    color: '#E85D4C',
    fontWeight: '600',
    alignSelf: 'flex-end',
  },
  addPromptBtn: {
    backgroundColor: theme.background,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.border,
    borderStyle: 'dashed',
  },
  addPromptBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.foreground,
  },

  listingFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  listingInput: {
    backgroundColor: theme.inputBackground,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.foreground,
  },
});
