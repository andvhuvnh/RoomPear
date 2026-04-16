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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import { getProfileImageUrls, pickImage } from '../lib/storage';
import { getPreferences, savePreferences, type Preferences } from '../lib/preferences';
import { formatLocationLine, profilePhotoPathsFromRow } from '../lib/profileDisplay';
import { appendProfilePhoto, removeProfilePhotoAt, replaceProfilePhotoAt, MAX_PROFILE_PHOTOS } from '../lib/profilePhotos';
import PublicProfileCard from '../components/PublicProfileCard';
import ProfileDetailsForm from '../components/ProfileDetailsForm';
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

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editPhotosOpen, setEditPhotosOpen] = useState(false);
  const [editPrefsOpen, setEditPrefsOpen] = useState(false);
  const [editPromptsOpen, setEditPromptsOpen] = useState(false);
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

  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editOccupation, setEditOccupation] = useState('');
  const [editHobbies, setEditHobbies] = useState<string[]>([]);
  const [editHobbyDraft, setEditHobbyDraft] = useState('');

  const loadListing = useCallback(async (userId: string) => {
    const l = await getListing(userId);
    setListing(l);
  }, []);

  const openListingModal = () => {
    setEditRent(listing?.rent != null ? String(listing.rent) : '');
    setEditRoomType(listing?.room_type ?? '');
    setEditAddress(listing?.address ?? '');
    setEditListingCity(listing?.city ?? '');
    setEditListingState(listing?.state ?? '');
    setEditListingZip(listing?.zip_code ?? '');
    setEditMoveInDate(listing?.move_in_date ?? '');
    setListingOpen(true);
  };

  const handleSaveListing = async () => {
    if (!user) return;
    setSavingListing(true);
    try {
      const result = await saveListing(user.id, {
        rent: editRent ? parseFloat(editRent) : null,
        room_type: editRoomType.trim() || null,
        address: editAddress.trim() || null,
        city: editListingCity.trim() || null,
        state: editListingState.trim() || null,
        zip_code: editListingZip.trim() || null,
        move_in_date: editMoveInDate.trim() || null,
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
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ? { id: u.id, email: u.email } : null);
      if (u) { loadProfile(u.id); loadListing(u.id); }
    });

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

  const openEditProfile = () => {
    if (!profile) return;
    setEditName(profile.name?.trim() ?? '');
    setEditBio(profile.bio?.trim() ?? '');
    setEditOccupation(profile.occupation?.trim() ?? '');
    setEditHobbies(Array.isArray(profile.hobbies) ? [...profile.hobbies] : []);
    setEditHobbyDraft('');
    setEditProfileOpen(true);
  };

  const handleAddEditHobby = () => {
    const t = editHobbyDraft.trim();
    if (!t || editHobbies.includes(t) || editHobbies.length >= 10) return;
    setEditHobbies([...editHobbies, t]);
    setEditHobbyDraft('');
  };

  const handleRemoveEditHobby = (h: string) => {
    setEditHobbies(editHobbies.filter((x) => x !== h));
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editName.trim() || profile?.name,
          bio: editBio.trim() || null,
          occupation: editOccupation.trim() || null,
          hobbies: editHobbies,
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      setEditProfileOpen(false);
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 16 + insets.top,
            paddingBottom: 32 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.tagline}>How you appear to others</Text>

        {user && (
          <>
            <PublicProfileCard
              imageUrls={imageUrls}
              name={displayName}
              age={displayAge}
              location={formatLocationLine(prefs)}
              bio={profile?.bio ?? ''}
              hobbies={Array.isArray(profile?.hobbies) ? profile.hobbies : []}
            />

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.primaryButton} onPress={openEditProfile}>
                <Text style={styles.primaryButtonText}>Edit profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditPhotosOpen(true)}>
                <Text style={styles.secondaryButtonText}>Edit photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={openEditPrefs}>
                <Text style={styles.secondaryButtonText}>Edit interests & dealbreakers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={openEditPrompts}>
                <Text style={styles.secondaryButtonText}>Edit prompts</Text>
              </TouchableOpacity>
            </View>

            {/* ── My Listing ── */}
            <View style={styles.listingCard}>
              <Text style={styles.accountTitle}>My Place Listing</Text>
              {listing ? (
                <>
                  <View style={styles.listingRow}>
                    <Text style={styles.listingValue}>
                      {listing.room_type ?? 'Room'}{listing.city ? ` · ${listing.city}${listing.state ? `, ${listing.state}` : ''}` : ''}
                    </Text>
                    {listing.rent != null && (
                      <Text style={styles.listingRent}>${listing.rent}/mo</Text>
                    )}
                  </View>
                  {listing.move_in_date && (
                    <Text style={styles.listingSub}>Available {listing.move_in_date}</Text>
                  )}
                  <View style={styles.listingBtns}>
                    <TouchableOpacity style={styles.listingEditBtn} onPress={openListingModal}>
                      <Text style={styles.listingEditBtnText}>Edit listing</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.listingDeleteBtn} onPress={handleDeleteListing}>
                      <Text style={styles.listingDeleteBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.listingSub}>Let others know you have a place available.</Text>
                  <TouchableOpacity style={styles.primaryButton} onPress={openListingModal}>
                    <Text style={styles.primaryButtonText}>Add a listing</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <View style={styles.accountCard}>
              <Text style={styles.accountTitle}>Invite friends</Text>
              <Text style={styles.inviteHelp}>
                Share your code. When a friend joins RoomPear and applies it, you both get +1 bonus reveal
                on Likes (on top of your daily free reveal).
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
                    placeholderTextColor="#7B8A99"
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
                      <ActivityIndicator color="#FDFDFD" />
                    ) : (
                      <Text style={styles.referralApplyBtnText}>Apply code</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.inviteLinked}>You joined with a friend&apos;s referral.</Text>
              )}
            </View>

            <View style={styles.accountCard}>
              <Text style={styles.accountTitle}>Account</Text>
              {user.email ? (
                <View style={styles.accountRow}>
                  <Text style={styles.accountLabel}>Email</Text>
                  <Text style={styles.accountValue}>{user.email}</Text>
                </View>
              ) : null}
              {profile?.phone ? (
                <View style={styles.accountRow}>
                  <Text style={styles.accountLabel}>Phone</Text>
                  <Text style={styles.accountValue}>{profile.phone}</Text>
                </View>
              ) : null}
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Plan</Text>
                <Text style={styles.accountValue}>
                  {(profile?.subscription_tier as string) || 'free'}
                </Text>
              </View>
              <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <Text style={styles.signOutButtonText}>Sign out</Text>
              </TouchableOpacity>
              {__DEV__ && onDevShowOnboarding && (
                <TouchableOpacity style={styles.devButton} onPress={onDevShowOnboarding}>
                  <Text style={styles.devButtonText}>DEV: Preview Onboarding</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={editProfileOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditProfileOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditProfileOpen(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit profile</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? (
                <ActivityIndicator color="#189AA2" />
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
            <ProfileDetailsForm
              variant="modal"
              showName
              name={editName}
              onChangeName={setEditName}
              bio={editBio}
              onChangeBio={setEditBio}
              occupation={editOccupation}
              onChangeOccupation={setEditOccupation}
              hobbies={editHobbies}
              hobbyDraft={editHobbyDraft}
              onChangeHobbyDraft={setEditHobbyDraft}
              onAddHobby={handleAddEditHobby}
              onRemoveHobby={handleRemoveEditHobby}
              footerHint="Location comes from your housing preferences (onboarding)."
            />
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
              {savingPrefs ? <ActivityIndicator color="#189AA2" /> : <Text style={styles.modalSave}>Save</Text>}
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
              {savingPrompts ? <ActivityIndicator color="#189AA2" /> : <Text style={styles.modalSave}>Save</Text>}
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
              <ActivityIndicator style={{ marginVertical: 16 }} color="#189AA2" />
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
              {savingListing ? <ActivityIndicator color="#189AA2" /> : <Text style={styles.modalSave}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">

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
    backgroundColor: '#E8EEF2',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0C5389',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 15,
    color: '#189AA2',
    marginBottom: 20,
  },
  actionRow: {
    marginTop: 24,
  },
  primaryButton: {
    backgroundColor: '#46BD7F',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FDFDFD',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FDFDFD',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#189AA2',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#0C5389',
    fontSize: 16,
    fontWeight: '600',
  },
  accountCard: {
    marginTop: 28,
    backgroundColor: '#FDFDFD',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  accountTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0C5389',
    marginBottom: 14,
  },
  accountRow: {
    marginBottom: 12,
  },
  accountLabel: {
    fontSize: 12,
    color: '#189AA2',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  accountValue: {
    fontSize: 16,
    color: '#0C5389',
  },
  inviteHelp: {
    fontSize: 14,
    color: '#4A6070',
    lineHeight: 20,
    marginBottom: 14,
  },
  referralCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F8FA',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    marginBottom: 16,
  },
  referralCodeText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#0C5389',
  },
  referralCopyBtn: {
    backgroundColor: '#0C5389',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  referralCopyBtnText: {
    color: '#FDFDFD',
    fontWeight: '700',
    fontSize: 14,
  },
  inviteLabel: {
    fontSize: 12,
    color: '#189AA2',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  referralInput: {
    borderWidth: 1,
    borderColor: '#D9E1E6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#0B1B2B',
    marginBottom: 10,
  },
  referralApplyBtn: {
    backgroundColor: '#189AA2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  referralApplyBtnDim: {
    opacity: 0.65,
  },
  referralApplyBtnText: {
    color: '#FDFDFD',
    fontWeight: '700',
    fontSize: 16,
  },
  inviteLinked: {
    fontSize: 14,
    color: '#46BD7F',
    fontWeight: '600',
  },
  signOutButton: {
    marginTop: 16,
    backgroundColor: '#D9E1E6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#0C5389',
    fontSize: 16,
    fontWeight: '600',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#FDFDFD',
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D9E1E6',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0C5389',
  },
  modalCancel: {
    fontSize: 17,
    color: '#189AA2',
    width: 72,
  },
  modalSave: {
    fontSize: 17,
    fontWeight: '600',
    color: '#46BD7F',
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
    color: '#0C5389',
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
    backgroundColor: '#F5F8FA',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#D9E1E6',
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
    color: '#0C5389',
    marginBottom: 6,
  },
  photoRemoveLink: {
    fontSize: 15,
    color: '#E85D4C',
    fontWeight: '600',
  },
  addPhotoBtn: {
    marginTop: 20,
    backgroundColor: '#46BD7F',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addPhotoBtnDisabled: {
    opacity: 0.5,
  },
  addPhotoBtnText: {
    color: '#FDFDFD',
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
    color: '#0C5389',
    marginBottom: 4,
  },
  prefSectionSub: {
    fontSize: 13,
    color: '#4A6070',
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
    color: '#0C5389',
  },
  catChevron: {
    fontSize: 12,
    color: '#189AA2',
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
    backgroundColor: '#189AA2',
    borderColor: '#189AA2',
  },
  chipDim: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A6070',
  },
  chipTextOn: {
    color: '#FDFDFD',
  },
  dbRow: {
    marginBottom: 14,
  },
  dbLabel: {
    fontSize: 15,
    color: '#0C5389',
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
    backgroundColor: '#E8F5E9',
    borderColor: '#46BD7F',
  },
  dbBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A6070',
  },
  dbBtnTextActive: {
    color: '#0C5389',
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
    color: '#0C5389',
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
    color: '#0C5389',
    lineHeight: 20,
  },
  promptQuestionPlaceholder: {
    color: '#9AA',
    fontWeight: '400',
  },
  promptQuestionEdit: {
    fontSize: 16,
    color: '#189AA2',
    marginLeft: 8,
  },
  promptAnswerInput: {
    fontSize: 15,
    color: '#0C5389',
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
    backgroundColor: '#FDFDFD',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#189AA2',
    borderStyle: 'dashed',
  },
  addPromptBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#189AA2',
  },

  // ── Listing card ────────────────────────────────────────────────────────────
  listingCard: {
    marginTop: 20,
    backgroundColor: '#FDFDFD',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  listingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  listingValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0C5389',
    flex: 1,
  },
  listingRent: {
    fontSize: 15,
    fontWeight: '700',
    color: '#189AA2',
    marginLeft: 8,
  },
  listingSub: {
    fontSize: 13,
    color: '#4A6070',
    marginBottom: 14,
    lineHeight: 18,
  },
  listingBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  listingEditBtn: {
    flex: 1,
    backgroundColor: '#F4F7F9',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#189AA2',
  },
  listingEditBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C5389',
  },
  listingDeleteBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E53935',
  },
  listingDeleteBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E53935',
  },
  listingFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A6070',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  listingInput: {
    backgroundColor: '#F4F7F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0C5389',
  },
});
