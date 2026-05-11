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
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../lib/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { usePurchases } from '../context/PurchasesContext';
import { useDiscoverDeck } from '../context/DiscoverDeckContext';
import { formatPlanLabel, SUBSCRIPTION_TIER_PREMIUM } from '../lib/purchasesConfig';
import { setDevPremiumForced } from '../lib/devPremiumOverride';
import { supabase } from '../lib/supabase';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getProfileImageUrls, getProfileImageUrl, pickImage, uploadListingPhoto, pickListingImage } from '../lib/storage';
import { getPreferences, savePreferences, type Preferences } from '../lib/preferences';
import { formatLocationLine, profilePhotoPathsFromRow } from '../lib/profileDisplay';
import { appendProfilePhoto, removeProfilePhotoAt, replaceProfilePhotoAt, MAX_PROFILE_PHOTOS } from '../lib/profilePhotos';
import SwipeCard from '../components/SwipeCard';
import type { DiscoverProfile } from '../lib/discover';
import * as Clipboard from 'expo-clipboard';
import { redeemReferralCode, redeemErrorMessage } from '../lib/referrals';
import { getListing, saveListing, deleteListing, type Listing } from '../lib/listings';
import ListingModal from './profile/ListingModal';
import SettingsModal from './profile/SettingsModal';
import BlockedUsersModal from '../components/BlockedUsersModal';
import EditNameModal from './profile/EditNameModal';
import {
  DEALBREAKER_ITEMS,
  INTEREST_CATEGORIES,
  MAX_LISTING_PHOTOS,
  PROMPTS,
} from './profile/userProfileConstants';

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
  const {
    isRoomPearPlus,
    refreshCustomerInfo,
    presentPaywall,
    presentCustomerCenter,
    logoutPurchases,
  } = usePurchases();
  const { syncPremiumFromDatabase } = useDiscoverDeck();
  /** Overlapping strip: portrait width + height (not square). */
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [profileEditorSection, setProfileEditorSection] = useState<
    'photos' | 'interests' | 'dealbreakers' | 'prompts' | 'basics' | null
  >(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [blockedUsersOpen, setBlockedUsersOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingPrompts, setSavingPrompts] = useState(false);

  const [referralDraft, setReferralDraft] = useState('');
  const [referralBusy, setReferralBusy] = useState(false);
  const [devPremiumBusy, setDevPremiumBusy] = useState(false);

  // Edit preferences state
  const [editInterests, setEditInterests] = useState<Record<string, string[]>>({});
  const [editDealbreakers, setEditDealbreakers] = useState<Record<string, DealbreakerLevel>>({});
  const [expandedPrefCat, setExpandedPrefCat] = useState<string | null>('fitness');

  // Edit basics state
  const [editBio, setEditBio] = useState('');
  const [editOccupation, setEditOccupation] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editEthnicity, setEditEthnicity] = useState('');
  const [editWorkSchedule, setEditWorkSchedule] = useState('');
  const [editSocialPref, setEditSocialPref] = useState('');
  const [editCleanliness, setEditCleanliness] = useState<number | null>(null);
  const [savingBasics, setSavingBasics] = useState(false);

  // Edit prompts state
  const [editPrompts, setEditPrompts] = useState<PromptEntry[]>([]);
  const [promptPickerIndex, setPromptPickerIndex] = useState<number | null>(null);

  // Listing state
  const [listing, setListing] = useState<Listing | null>(null);
  const [listingPhotoUrls, setListingPhotoUrls] = useState<string[]>([]);
  const [listingOpen, setListingOpen] = useState(false);
  const [savingListing, setSavingListing] = useState(false);
  const [editRent, setEditRent] = useState('');
  const [editRoomType, setEditRoomType] = useState('');
  const [editListingPhotos, setEditListingPhotos] = useState<ListingPhotoItem[]>([]);

  const [editName, setEditName] = useState('');


  const socialPrefToLabel = (val: string | null | undefined): string => {
    if (val === 'social') return 'Social Butterfly';
    if (val === 'quiet') return 'Homebody';
    if (val === 'balanced') return 'Balanced';
    return val ?? '';
  };

  const activateProfileSection = useCallback(
    (section: 'photos' | 'interests' | 'dealbreakers' | 'prompts' | 'basics') => {
      if (profileEditorSection === section) {
        setProfileEditorSection(null);
        return;
      }
      if (section === 'interests' || section === 'dealbreakers') {
        const defaultDB = Object.fromEntries(
          DEALBREAKER_ITEMS.map((d) => [d.key, 'none' as DealbreakerLevel])
        );
        setEditInterests(prefs?.interests ?? {});
        setEditDealbreakers({ ...defaultDB, ...(prefs?.dealbreakers ?? {}) });
        setExpandedPrefCat('fitness');
      }
      if (section === 'prompts') {
        const current: PromptEntry[] = Array.isArray(profile?.prompts)
          ? [...profile.prompts]
          : [];
        setEditPrompts(current.length > 0 ? current : [{ question: '', answer: '' }]);
        setPromptPickerIndex(null);
      }
      if (section === 'basics') {
        setEditBio(profile?.bio ?? '');
        setEditOccupation(profile?.occupation ?? '');
        setEditGender(profile?.gender ?? '');
        setEditEthnicity(profile?.ethnicity ?? '');
        setEditWorkSchedule(prefs?.work_schedule ?? '');
        setEditSocialPref(socialPrefToLabel(prefs?.social_preference));
        setEditCleanliness(prefs?.cleanliness_level ?? null);
      }
      setProfileEditorSection(section);
    },
    [profileEditorSection, prefs, profile?.prompts, profile?.bio, profile?.gender, profile?.ethnicity, profile?.social_preference]
  );

  const loadListing = useCallback(async (userId: string) => {
    const l = await getListing(userId);
    setListing(l);
    const paths = l?.listing_photos ?? [];
    if (paths.length === 0) {
      setListingPhotoUrls([]);
      return;
    }
    const urls = await Promise.all(paths.map((path) => getProfileImageUrl(path)));
    setListingPhotoUrls(urls.filter((u): u is string => Boolean(u)));
  }, []);

  const openListingModal = async () => {
    setEditRent(listing?.rent != null ? String(listing.rent) : '');
    setEditRoomType(listing?.room_type ?? '');
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
    setIsPaused(data?.is_paused === true);

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

  useFocusEffect(
    useCallback(() => {
      refreshCustomerInfo().catch(() => {});
    }, [refreshCustomerInfo])
  );

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

  const handleSavePrefs = async () => {
    if (!user) return;
    setSavingPrefs(true);
    try {
      await savePreferences(user.id, { interests: editInterests, dealbreakers: editDealbreakers });
      setProfileEditorSection(null);
      const p = await getPreferences(user.id);
      setPrefs(p);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSaveBasics = async () => {
    if (!user) return;
    setSavingBasics(true);
    try {
      const profileUpdates: Record<string, any> = {};
      if (editBio.trim() !== (profile?.bio ?? '')) profileUpdates.bio = editBio.trim() || null;
      if (editOccupation.trim() !== (profile?.occupation ?? '')) profileUpdates.occupation = editOccupation.trim() || null;
      if (editGender !== (profile?.gender ?? '')) profileUpdates.gender = editGender || null;
      if (editEthnicity !== (profile?.ethnicity ?? '')) profileUpdates.ethnicity = editEthnicity || null;
      if (Object.keys(profileUpdates).length > 0) {
        await supabase.from('profiles').update(profileUpdates).eq('id', user.id);
      }

      const socialMapped =
        editSocialPref === 'Social Butterfly' ? 'social'
        : editSocialPref === 'Homebody' ? 'quiet'
        : editSocialPref === 'Balanced' ? 'balanced'
        : undefined;

      const prefUpdates: Partial<Preferences> = {};
      if (editWorkSchedule) prefUpdates.work_schedule = editWorkSchedule;
      if (socialMapped) prefUpdates.social_preference = socialMapped as any;
      if (editCleanliness != null) prefUpdates.cleanliness_level = editCleanliness;

      if (Object.keys(prefUpdates).length > 0) {
        await savePreferences(user.id, prefUpdates);
      }

      setProfileEditorSection(null);
      await loadProfile(user.id);
      const p = await getPreferences(user.id);
      setPrefs(p);
    } finally {
      setSavingBasics(false);
    }
  };

  const handleSavePrompts = async () => {
    if (!user) return;
    setSavingPrompts(true);
    try {
      const filtered = editPrompts.filter((p) => p.question && p.answer.trim());
      await supabase.from('profiles').update({ prompts: filtered }).eq('id', user.id);
      setProfileEditorSection(null);
      await loadProfile(user.id);
    } finally {
      setSavingPrompts(false);
    }
  };

  const handleSignOut = async () => {
    await logoutPurchases();
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error', error.message);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently removes your RoomPear data and signs you out.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm deletion',
              'This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete forever',
                  style: 'destructive',
                  onPress: async () => {
                    if (!user) return;
                    try {
                      const { error } = await supabase.rpc('delete_my_account');
                      if (error) {
                        Alert.alert(
                          'Delete failed',
                          error.message || 'Account deletion is not fully configured yet. Please contact support to complete deletion.'
                        );
                        return;
                      }
                      await logoutPurchases();
                      await supabase.auth.signOut();
                    } catch {
                      Alert.alert(
                        'Delete unavailable',
                        'Could not delete your account right now. Please try again later.'
                      );
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleTogglePause = async (value: boolean) => {
    if (!user) return;
    setIsPaused(value);
    const { error } = await supabase
      .from('profiles')
      .update({ is_paused: value })
      .eq('id', user.id);
    if (error) {
      setIsPaused(!value);
      Alert.alert('Error', 'Could not update visibility. Try again.');
    }
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

  const handleDevTogglePremium = async (premiumEnabled: boolean) => {
    if (!user) return;
    const nextTier = premiumEnabled ? SUBSCRIPTION_TIER_PREMIUM : 'free';
    setDevPremiumBusy(true);
    try {
      // Set before DB + before any RC refresh so `syncSubscriptionTierToProfile` cannot clobber premium.
      await setDevPremiumForced(premiumEnabled);
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_tier: nextTier })
        .eq('id', user.id);
      if (error) {
        await setDevPremiumForced(false);
        Alert.alert('Dev toggle failed', error.message);
        return;
      }
      await loadProfile(user.id);
      await syncPremiumFromDatabase();
      // Do not call refreshCustomerInfo() when enabling premium: it syncs RC → DB as free without a purchase.
      if (!premiumEnabled) {
        await refreshCustomerInfo();
      }
    } catch {
      await setDevPremiumForced(false);
      Alert.alert('Dev toggle failed', 'Could not update subscription tier right now.');
    } finally {
      setDevPremiumBusy(false);
    }
  };

  const displayName = profile?.name?.trim() || '';
  const displayAge =
    typeof profile?.age === 'number' && !Number.isNaN(profile.age)
      ? profile.age
      : null;
  const profileInterests = useMemo(() => {
    const grouped = prefs?.interests;
    if (!grouped || typeof grouped !== 'object') return [] as string[];
    const values = Object.values(grouped).flatMap((entry) =>
      Array.isArray(entry) ? entry.filter((v): v is string => typeof v === 'string') : []
    );
    return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).slice(0, 12);
  }, [prefs?.interests]);
  const profileHobbies = useMemo(() => {
    const raw = profile?.hobbies;
    if (Array.isArray(raw)) {
      return raw
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 12);
    }
    if (typeof raw === 'string') {
      return raw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 12);
    }
    return [] as string[];
  }, [profile?.hobbies]);
  const listingSearchLocationLine = useMemo(() => {
    const fromPrefs = formatLocationLine(prefs);
    if (fromPrefs) return fromPrefs;
    if (!listing) return '';
    const city = listing.city?.trim();
    const state = listing.state?.trim();
    if (city && state) return `${city}, ${state}`;
    return city || state || '';
  }, [prefs, listing]);
  const profilePromptsForOverview = useMemo(() => {
    const raw = profile?.prompts;
    if (!Array.isArray(raw)) return [] as { question: string; answer: string }[];
    return raw
      .filter(
        (p): p is { question: string; answer: string } =>
          p != null &&
          typeof p === 'object' &&
          typeof (p as { question?: unknown }).question === 'string' &&
          typeof (p as { answer?: unknown }).answer === 'string'
      )
      .map((p) => ({
        question: (p as { question: string }).question.trim(),
        answer: (p as { answer: string }).answer.trim(),
      }))
      .filter((p) => p.question && p.answer);
  }, [profile?.prompts]);

  const profileSaysPremium =
    String(profile?.subscription_tier || '').toLowerCase() === SUBSCRIPTION_TIER_PREMIUM;
  const showRoomPearPlus = isRoomPearPlus || profileSaysPremium;
  const openUpgradeIfNeeded = useCallback(async () => {
    if (showRoomPearPlus) return;
    await presentPaywall();
  }, [showRoomPearPlus, presentPaywall]);

  // ── New derived values for redesigned profile ─────────────────────────────
  const [stats, setStats] = useState({ views: 0, likes: 0, matches: 0 });
  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const [{ count: likeCount }, { count: matchCount }] = await Promise.all([
        supabase.from('swipes').select('id', { count: 'exact', head: true }).eq('swiped_id', user.id).in('direction', ['like', 'top_pick']),
        supabase.from('conversation_participants').select('conversation_id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      setStats({ views: 0, likes: likeCount ?? 0, matches: matchCount ?? 0 });
    })();
  }, [user?.id]);

  const completionPct = useMemo(() => {
    let score = 0;
    if (imageUrls.length > 0) score += 20;
    if (profile?.bio?.trim()) score += 15;
    if (profile?.occupation?.trim()) score += 10;
    const hasInterests = prefs?.interests && (Object.values(prefs.interests as Record<string, string[]>)).some((arr) => Array.isArray(arr) && arr.length > 0);
    if (hasInterests) score += 20;
    const validPrompts = Array.isArray(profile?.prompts) ? profile.prompts.filter((p: any) => p?.question && p?.answer) : [];
    score += Math.round((Math.min(validPrompts.length, 3) / 3) * 20);
    if (prefs?.city || prefs?.state) score += 10;
    if (prefs?.min_budget || prefs?.max_budget) score += 5;
    return score;
  }, [imageUrls, profile, prefs]);

  const completionHint = useMemo(() => {
    const validPrompts = Array.isArray(profile?.prompts) ? profile.prompts.filter((p: any) => p?.question && p?.answer) : [];
    const need = 3 - Math.min(validPrompts.length, 3);
    if (need > 0) return `add ${need} more prompt${need > 1 ? 's' : ''} to hit 90%`;
    if (!profile?.occupation?.trim()) return 'add your occupation to boost your score';
    return '';
  }, [profile]);

  const vibesChips = useMemo(() => {
    const chips: string[] = [];
    if (prefs?.social_preference === 'quiet') chips.push('homebody');
    else if (prefs?.social_preference === 'social') chips.push('social');
    else if (prefs?.social_preference === 'balanced') chips.push('chill');
    if (prefs?.work_schedule === '9-to-5') chips.push('early bird');
    else if (prefs?.work_schedule === 'Remote') chips.push('wfh');
    else if (prefs?.work_schedule === 'Night Shift') chips.push('night owl');
    else if (prefs?.work_schedule === 'Flexible') chips.push('flexible');
    if (prefs?.cleanliness_level != null) {
      if (prefs.cleanliness_level <= 2) chips.push('messy-ish');
      else if (prefs.cleanliness_level === 3) chips.push('clean-ish');
      else chips.push('spotless');
    }
    return chips;
  }, [prefs]);

  const formattedMoveIn = useMemo(() => {
    const d = prefs?.move_in_date;
    if (!d) return '';
    try {
      const parts = d.split('-');
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diffDays = Math.round((date.getTime() - now.getTime()) / 86_400_000);
      if (diffDays <= 3)  return 'Immediately';
      if (diffDays <= 20) return 'Within 2 weeks';
      if (diffDays <= 45) return 'Within 1 month';
      if (diffDays <= 100) return '1–3 months';
      return '3–6 months';
    } catch { return ''; }
  }, [prefs?.move_in_date]);

  const previewProfile = useMemo<DiscoverProfile>(() => ({
    id: user?.id ?? '',
    name: displayName || 'You',
    age: displayAge,
    occupation: profile?.occupation ?? null,
    bio: profile?.bio ?? null,
    hobbies: profileHobbies.length > 0 ? profileHobbies : null,
    interests: (prefs?.interests as Record<string, string[]>) ?? {},
    prompts: profilePromptsForOverview,
    photoUrls: [...imageUrls, ...listingPhotoUrls],
    profilePhotoCount: imageUrls.length,
    location: listingSearchLocationLine,
    hasListing: listing != null,
    roomType: prefs?.room_type ?? null,
    listingRoomType: listing?.room_type ?? null,
    minBudget: prefs?.min_budget ?? null,
    maxBudget: prefs?.max_budget ?? null,
    compatibilityScore: 0,
    matchReasons: [],
  }), [user?.id, displayName, displayAge, profile, prefs, profileHobbies, profilePromptsForOverview, imageUrls, listingPhotoUrls, listingSearchLocationLine, listing]);

  const MenuItem = ({ icon, label, sub, onPress, destructive }: { icon: string; label: string; sub?: string; onPress: () => void; destructive?: boolean }) => (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconBadge, destructive && styles.menuIconBadgeDestructive]}>
        <Ionicons name={icon as any} size={18} color={destructive ? '#D4183D' : '#111111'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, destructive && styles.menuLabelDestructive]}>{label}</Text>
        {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.3)" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#C8EAC0', '#D4EEB8', '#E2F0C8', '#EEF6E0', '#F6FAF0', '#FFFFFF']}
        locations={[0, 0.18, 0.40, 0.62, 0.82, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.blobLayer} pointerEvents="none">
        <View style={[styles.blob, styles.blobA]} />
        <View style={[styles.blob, styles.blobB]} />
        <View style={[styles.blob, styles.blobC]} />
      </View>

      {user && (
        <View style={[styles.profileRoot, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{displayName}</Text>
            <Pressable
              onPress={() => setSettingsOpen(true)}
              style={({ pressed }) => [styles.gearBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={20} color="#111111" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.profileScroll}
            contentContainerStyle={[styles.profileScrollContent, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Photo circles */}
            <View style={styles.photoCirclesRow}>
              {/* Personal photo */}
              <TouchableOpacity style={styles.photoCircleWrap} onPress={() => activateProfileSection('photos')} activeOpacity={0.85}>
                {imageUrls.length > 0 ? (
                  <Image source={{ uri: imageUrls[0] }} style={styles.photoCircle} resizeMode="cover" />
                ) : (
                  <View style={[styles.photoCircle, styles.photoCircleEmpty]}>
                    <Ionicons name="person-outline" size={32} color="#8AA89A" />
                  </View>
                )}
                <View style={styles.photoCircleEditBadge}>
                  <Ionicons name="camera" size={11} color="#fff" />
                </View>
                <Text style={styles.photoCircleLabel}>you</Text>
              </TouchableOpacity>

              {/* Place photo */}
              <TouchableOpacity style={styles.photoCircleWrap} onPress={() => void openListingModal()} activeOpacity={0.85}>
                {listingPhotoUrls.length > 0 ? (
                  <Image source={{ uri: listingPhotoUrls[0] }} style={styles.photoCircle} resizeMode="cover" />
                ) : (
                  <View style={[styles.photoCircle, styles.photoCircleEmpty]}>
                    <Ionicons name="home-outline" size={32} color="#8AA89A" />
                  </View>
                )}
                <View style={styles.photoCircleEditBadge}>
                  <Ionicons name="camera" size={11} color="#fff" />
                </View>
                <Text style={styles.photoCircleLabel}>place</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.contentPad}>
              {isPaused && (
                <View style={styles.pausedBanner}>
                  <Ionicons name="pause-circle-outline" size={15} color="#7A5C00" />
                  <Text style={styles.pausedBannerText}>Profile paused — not showing in discover</Text>
                </View>
              )}

              {/* Profile strength */}
              <View style={styles.strengthSection}>
                <View style={styles.strengthRow}>
                  <Text style={styles.strengthLabel}>PROFILE STRENGTH</Text>
                  <Text style={styles.strengthScore}>{completionPct}% complete</Text>
                </View>
                <View style={styles.strengthBarTrack}>
                  <View style={[styles.strengthBarFill, { width: `${completionPct}%` as any }]} />
                </View>
                {completionHint ? <Text style={styles.strengthHint}>{completionHint}</Text> : null}
              </View>

              {/* Info chips */}
              {(prefs?.min_budget || prefs?.max_budget || formattedMoveIn || prefs?.room_type) ? (
                <View style={styles.infoChipsRow}>
                  {(prefs?.min_budget || prefs?.max_budget) ? (
                    <View style={styles.infoPill}>
                      <Text style={styles.infoPillText}>${prefs?.min_budget ?? '?'}–${prefs?.max_budget ?? '?'}/mo</Text>
                    </View>
                  ) : null}
                  {formattedMoveIn ? (
                    <View style={styles.infoPill}>
                      <Text style={styles.infoPillText}>{formattedMoveIn}</Text>
                    </View>
                  ) : null}
                  {prefs?.room_type ? (
                    <View style={styles.infoPill}>
                      <Text style={styles.infoPillText}>{prefs.room_type} room</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* About */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>ABOUT</Text>
                  <TouchableOpacity onPress={() => activateProfileSection('basics')} activeOpacity={0.7}>
                    <Text style={styles.sectionEditLink}>edit</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.bioText}>{profile?.bio?.trim() || 'Add a bio to tell future roommates about yourself.'}</Text>
              </View>

              {/* My vibes */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>my vibes</Text>
                <View style={styles.vibesRow}>
                  {vibesChips.map((chip) => (
                    <View key={chip} style={styles.vibeChip}>
                      <Text style={styles.vibeChipText}>{chip}</Text>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.vibeAddBtn} onPress={() => activateProfileSection('basics')} activeOpacity={0.85}>
                    <Text style={styles.vibeAddText}>+ add</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Prompts */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>your prompts</Text>
                  <Text style={styles.promptCountBadge}>{profilePromptsForOverview.length}/3</Text>
                </View>
                {profilePromptsForOverview.map((p, i) => (
                  <TouchableOpacity key={i} style={[styles.promptViewCard, i > 0 && { marginTop: 8 }]} onPress={() => activateProfileSection('prompts')} activeOpacity={0.85}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.promptViewQ}>{p.question.toUpperCase()}</Text>
                      <Text style={styles.promptViewA}>{p.answer}</Text>
                    </View>
                    <Ionicons name="pencil-outline" size={16} color="#8AA89A" />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.addPromptDashed} onPress={() => activateProfileSection('prompts')} activeOpacity={0.85}>
                  <Ionicons name="sparkles-outline" size={14} color="#8AA89A" />
                  <Text style={styles.addPromptDashedText}>add a prompt</Text>
                </TouchableOpacity>
              </View>

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{stats.views}</Text>
                  <Text style={styles.statLabel}>PROFILE VIEWS</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{stats.likes}</Text>
                  <Text style={styles.statLabel}>LIKES YOU</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{stats.matches}</Text>
                  <Text style={styles.statLabel}>MATCHES</Text>
                </View>
              </View>

              {/* Preview as roommate */}
              <TouchableOpacity style={styles.previewBtn} activeOpacity={0.9} onPress={() => setPreviewOpen(true)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewBtnTitle}>preview as a roommate</Text>
                  <Text style={styles.previewBtnSub}>see how your card actually swipes</Text>
                </View>
                <Ionicons name="eye-outline" size={22} color="white" />
              </TouchableOpacity>

              {/* Account */}
              <Text style={styles.accountSectionLabel}>ACCOUNT</Text>
              <View style={styles.accountMenu}>
                <MenuItem icon="flash-outline" label="boost your profile" sub="get 10x more views for 30 min" onPress={() => void presentPaywall()} />
                <View style={styles.menuDivider} />
                <MenuItem icon="people-outline" label="invite a friend" sub="skip the line — both get a week free" onPress={() => setSettingsOpen(true)} />
                <View style={styles.menuDivider} />
                <MenuItem icon="notifications-outline" label="notifications" sub="matches, messages, nudges" onPress={() => setSettingsOpen(true)} />
                <View style={styles.menuDivider} />
                <MenuItem icon="shield-outline" label="safety & privacy" sub="block list, hide profile, verify" onPress={() => setSettingsOpen(true)} />
                <View style={styles.menuDivider} />
                <MenuItem icon="log-out-outline" label="log out" onPress={handleSignOut} destructive />
              </View>

              <Text style={styles.footerText}>v1.0 · made with care in CA</Text>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Profile editor modal */}
      <Modal visible={profileEditorSection !== null} transparent animationType="slide" onRequestClose={() => setProfileEditorSection(null)}>
        <View style={styles.editorModalBg}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setProfileEditorSection(null)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.editorSheet}>
            <View style={styles.editorHandle} />
            <View style={styles.editorHeaderRow}>
              <Text style={styles.editorTitle}>
                {profileEditorSection === 'photos' ? 'Photos'
                  : profileEditorSection === 'basics' ? 'About Me'
                  : profileEditorSection === 'interests' ? 'Interests'
                  : profileEditorSection === 'dealbreakers' ? 'Dealbreakers'
                  : 'Prompts'}
              </Text>
              <TouchableOpacity onPress={() => setProfileEditorSection(null)}>
                <Ionicons name="close" size={24} color="#3A3A3A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.editorScroll} contentContainerStyle={styles.editorScrollContent} keyboardShouldPersistTaps="handled" nestedScrollEnabled>

              {/* Photos */}
              {profileEditorSection === 'photos' && (
                <>
                  <Text style={styles.photoEditHeading}>your photos</Text>
                  <Text style={styles.photoEditSub}>Your first photo is your main — tap any to edit or remove</Text>
                  {savingPhotos && <ActivityIndicator style={{ marginVertical: 12 }} color="#111111" />}
                  <View style={styles.photoEditGrid}>
                    {imageUrls.map((url, idx) => (
                      <TouchableOpacity key={`photo-${idx}-${url}`} style={styles.photoEditThumb} onPress={() => handleRemovePhoto(idx)} disabled={savingPhotos} activeOpacity={0.85}>
                        <Image source={{ uri: url }} style={styles.photoEditThumbImg} />
                        <View style={styles.photoEditRemoveBtn}>
                          <Ionicons name="close" size={12} color="#fff" />
                        </View>
                        {idx === 0 && (
                          <View style={styles.photoEditMainBadge}>
                            <Text style={styles.photoEditMainBadgeText}>Main</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                    {photoPaths.length < MAX_PROFILE_PHOTOS && (
                      <TouchableOpacity style={styles.photoEditAddBtn} onPress={handleAddPhoto} disabled={savingPhotos} activeOpacity={0.8}>
                        <Ionicons name="camera-outline" size={28} color="#6A8070" />
                        <Text style={styles.photoEditAddText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {imageUrls.length === 0 && (
                    <TouchableOpacity style={styles.photoEditEmpty} onPress={handleAddPhoto} disabled={savingPhotos} activeOpacity={0.85}>
                      <Ionicons name="camera-outline" size={44} color="#9AA89A" />
                      <Text style={styles.photoEditEmptyTitle}>Add your first photo</Text>
                      <Text style={styles.photoEditEmptyHint}>Up to {MAX_PROFILE_PHOTOS} photos — your first is shown as your main</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* Basics */}
              {profileEditorSection === 'basics' && (
                <>
                  <Text style={styles.basicsLabel}>Bio</Text>
                  <TextInput style={styles.basicsTextInput} value={editBio} onChangeText={setEditBio} placeholder="Tell future roommates about yourself…" placeholderTextColor="#9AA89A" multiline maxLength={300} />
                  <Text style={styles.basicsLabel}>Occupation <Text style={styles.basicsOptional}>(optional)</Text></Text>
                  <TextInput style={[styles.basicsTextInput, { minHeight: 44 }]} value={editOccupation} onChangeText={setEditOccupation} placeholder="e.g. Student, Software Engineer…" placeholderTextColor="#9AA89A" maxLength={60} />
                  <Text style={styles.basicsLabel}>Gender</Text>
                  <View style={styles.chipsWrap}>
                    {['Man', 'Woman', 'Non-binary', 'Other', 'Prefer not to say'].map((g) => (
                      <TouchableOpacity key={g} style={[styles.chip, editGender === g && styles.chipOn]} onPress={() => setEditGender(editGender === g ? '' : g)}>
                        <Text style={[styles.chipText, editGender === g && styles.chipTextOn]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.basicsLabel}>Ethnicity <Text style={styles.basicsOptional}>(optional)</Text></Text>
                  <View style={styles.chipsWrap}>
                    {['Asian', 'Black / African American', 'Hispanic / Latino', 'Middle Eastern', 'Native American', 'Pacific Islander', 'White / Caucasian', 'Multiracial', 'Prefer not to say'].map((e) => (
                      <TouchableOpacity key={e} style={[styles.chip, editEthnicity === e && styles.chipOn]} onPress={() => setEditEthnicity(editEthnicity === e ? '' : e)}>
                        <Text style={[styles.chipText, editEthnicity === e && styles.chipTextOn]}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.basicsLabel}>Work Schedule</Text>
                  <View style={styles.chipsWrap}>
                    {[{ val: '9-to-5', label: '9 to 5' }, { val: 'Remote', label: 'Remote / WFH' }, { val: 'Night Shift', label: 'Night Shift' }, { val: 'Flexible', label: 'Flexible' }].map(({ val, label }) => (
                      <TouchableOpacity key={val} style={[styles.chip, editWorkSchedule === val && styles.chipOn]} onPress={() => setEditWorkSchedule(editWorkSchedule === val ? '' : val)}>
                        <Text style={[styles.chipText, editWorkSchedule === val && styles.chipTextOn]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.basicsLabel}>Social Vibe</Text>
                  <View style={styles.chipsWrap}>
                    {['Social Butterfly', 'Balanced', 'Homebody'].map((v) => (
                      <TouchableOpacity key={v} style={[styles.chip, editSocialPref === v && styles.chipOn]} onPress={() => setEditSocialPref(editSocialPref === v ? '' : v)}>
                        <Text style={[styles.chipText, editSocialPref === v && styles.chipTextOn]}>{v}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.basicsLabel}>Cleanliness <Text style={styles.basicsOptional}>(1 = relaxed · 5 = spotless)</Text></Text>
                  <View style={styles.chipsWrap}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity key={n} style={[styles.chip, editCleanliness === n && styles.chipOn]} onPress={() => setEditCleanliness(editCleanliness === n ? null : n)}>
                        <Text style={[styles.chipText, editCleanliness === n && styles.chipTextOn]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.accordionSaveBtn} onPress={handleSaveBasics} disabled={savingBasics} activeOpacity={0.85}>
                    {savingBasics ? <ActivityIndicator color="white" /> : <Text style={styles.accordionSaveBtnText}>Save</Text>}
                  </TouchableOpacity>
                </>
              )}

              {/* Interests */}
              {profileEditorSection === 'interests' && (
                <>
                  <Text style={styles.prefSectionSub}>Select up to 5 per category</Text>
                  {INTEREST_CATEGORIES.map((cat) => {
                    const selected = editInterests[cat.key] ?? [];
                    const isCatExpanded = expandedPrefCat === cat.key;
                    return (
                      <View key={cat.key} style={styles.catBlock}>
                        <TouchableOpacity style={styles.catHeader} onPress={() => setExpandedPrefCat(isCatExpanded ? null : cat.key)}>
                          <Text style={styles.catLabel}>{cat.label} {selected.length > 0 ? `(${selected.length})` : ''}</Text>
                          <Text style={styles.catChevron}>{isCatExpanded ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        {isCatExpanded ? (
                          <View style={styles.chipsWrap}>
                            {cat.options.map((opt) => {
                              const on = selected.includes(opt);
                              const disabled = !on && selected.length >= 5;
                              return (
                                <TouchableOpacity key={opt} style={[styles.chip, on && styles.chipOn, disabled && styles.chipDim]} disabled={disabled} onPress={() => setEditInterests((prev) => { const cur = prev[cat.key] ?? []; return { ...prev, [cat.key]: on ? cur.filter((x) => x !== opt) : [...cur, opt] }; })}>
                                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                  <TouchableOpacity style={styles.accordionSaveBtn} onPress={handleSavePrefs} disabled={savingPrefs} activeOpacity={0.85}>
                    {savingPrefs ? <ActivityIndicator color="white" /> : <Text style={styles.accordionSaveBtnText}>Save interests</Text>}
                  </TouchableOpacity>
                </>
              )}

              {/* Dealbreakers */}
              {profileEditorSection === 'dealbreakers' && (
                <>
                  {DEALBREAKER_ITEMS.map((item) => {
                    const val = editDealbreakers[item.key] ?? 'none';
                    return (
                      <View key={item.key} style={styles.dbRow}>
                        <Text style={styles.dbLabel}>{item.label}</Text>
                        <View style={styles.dbBtns}>
                          {([{ lvl: 'hard', label: 'Never' }, { lvl: 'soft', label: 'Prefer not' }, { lvl: 'none', label: 'Fine' }] as { lvl: DealbreakerLevel; label: string }[]).map(({ lvl, label }) => (
                            <TouchableOpacity key={lvl} style={[styles.dbBtn, val === lvl && (lvl === 'hard' ? styles.dbBtnHard : lvl === 'soft' ? styles.dbBtnSoft : styles.dbBtnNone)]} onPress={() => setEditDealbreakers((prev) => ({ ...prev, [item.key]: lvl }))}>
                              <Text style={[styles.dbBtnText, val === lvl && styles.dbBtnTextActive]}>{label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                  <TouchableOpacity style={styles.accordionSaveBtn} onPress={handleSavePrefs} disabled={savingPrefs} activeOpacity={0.85}>
                    {savingPrefs ? <ActivityIndicator color="white" /> : <Text style={styles.accordionSaveBtnText}>Save dealbreakers</Text>}
                  </TouchableOpacity>
                </>
              )}

              {/* Prompts */}
              {profileEditorSection === 'prompts' && (
                <>
                  <Text style={styles.prefSectionSub}>Pick up to 3 prompts and answer them.</Text>
                  {editPrompts.map((entry, idx) => (
                    <View key={idx} style={styles.promptBlock}>
                      {promptPickerIndex === idx ? (
                        <View style={styles.promptPickerList}>
                          {PROMPTS.filter((p) => !editPrompts.some((e, i) => i !== idx && e.question === p)).map((p) => (
                            <TouchableOpacity key={p} style={styles.promptPickerItem} onPress={() => { setEditPrompts((prev) => prev.map((e, i) => (i === idx ? { ...e, question: p } : e))); setPromptPickerIndex(null); }}>
                              <Text style={styles.promptPickerText}>{p}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.promptQuestion} onPress={() => setPromptPickerIndex(idx)}>
                          <Text style={[styles.promptQuestionText, !entry.question && styles.promptQuestionPlaceholder]}>{entry.question || 'Tap to choose a prompt…'}</Text>
                          <Text style={styles.promptQuestionEdit}>✎</Text>
                        </TouchableOpacity>
                      )}
                      <TextInput style={styles.promptAnswerInput} value={entry.answer} onChangeText={(t) => setEditPrompts((prev) => prev.map((e, i) => (i === idx ? { ...e, answer: t } : e)))} placeholder="Your answer…" placeholderTextColor="#9AA" multiline maxLength={300} />
                      <TouchableOpacity onPress={() => setEditPrompts((prev) => prev.filter((_, i) => i !== idx))}>
                        <Text style={styles.promptRemove}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {editPrompts.length < 3 ? (
                    <TouchableOpacity style={styles.addPromptBtn} onPress={() => setEditPrompts((prev) => [...prev, { question: '', answer: '' }])}>
                      <Text style={styles.addPromptBtnText}>+ Add prompt</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.accordionSaveBtn} onPress={handleSavePrompts} disabled={savingPrompts} activeOpacity={0.85}>
                    {savingPrompts ? <ActivityIndicator color="white" /> : <Text style={styles.accordionSaveBtnText}>Save prompts</Text>}
                  </TouchableOpacity>
                </>
              )}

            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Preview as roommate modal */}
      <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#0E0E16' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 12 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#FFFFFF' }}>how others see you</Text>
            <TouchableOpacity onPress={() => setPreviewOpen(false)}>
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, alignItems: 'center', paddingTop: 4 }}>
            <SwipeCard profile={previewProfile} />
          </View>
        </View>
      </Modal>

      <SettingsModal
        visible={settingsOpen}
        listing={listing}
        searchLocationLine={listingSearchLocationLine}
        profile={profile}
        user={user}
        referralDraft={referralDraft}
        referralBusy={referralBusy}
        setReferralDraft={setReferralDraft}
        onClose={() => setSettingsOpen(false)}
        onOpenEditName={() => afterCloseSettings(() => openEditName())}
        onOpenListing={() => afterCloseSettings(() => openListingModal())}
        onDeleteListing={handleDeleteListing}
        isPaused={isPaused}
        onTogglePause={handleTogglePause}
        onOpenBlockedUsers={() => afterCloseSettings(() => setBlockedUsersOpen(true))}
        onCopyReferralCode={handleCopyReferralCode}
        onApplyReferralCode={handleApplyReferralCode}
        isPremium={showRoomPearPlus}
        onUpgradeToPlus={() => { void openUpgradeIfNeeded(); }}
        onManageSubscription={() => { void presentCustomerCenter(); }}
        onDeleteAccount={handleDeleteAccount}
        onSignOut={handleSignOut}
        onDevShowOnboarding={onDevShowOnboarding}
        onDevTogglePremium={handleDevTogglePremium}
        devPremiumBusy={devPremiumBusy}
        styles={styles}
        theme={theme}
      />

      {user && (
        <BlockedUsersModal
          visible={blockedUsersOpen}
          userId={user.id}
          onClose={() => setBlockedUsersOpen(false)}
        />
      )}

      <EditNameModal
        visible={editNameOpen}
        savingProfile={savingProfile}
        editName={editName}
        setEditName={setEditName}
        onClose={() => setEditNameOpen(false)}
        onSave={handleSaveName}
        styles={styles}
        theme={theme}
      />

      <ListingModal
        visible={listingOpen}
        listingExists={Boolean(listing)}
        savingListing={savingListing}
        editListingPhotos={editListingPhotos}
        maxListingPhotos={MAX_LISTING_PHOTOS}
        editRent={editRent}
        editRoomType={editRoomType}
        setEditRent={setEditRent}
        setEditRoomType={setEditRoomType}
        setEditListingPhotos={setEditListingPhotos}
        onClose={() => setListingOpen(false)}
        onSave={handleSaveListing}
        onAddListingPhoto={handleAddListingPhoto}
        styles={styles}
        theme={theme}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#C8E6C9' },
  blobLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 0, overflow: 'hidden' },
  blob: { position: 'absolute' },
  blobA: { width: 280, height: 280, borderRadius: 140, backgroundColor: '#E8B84B', opacity: 0.13, top: -60, right: -60 },
  blobB: { width: 200, height: 200, borderRadius: 100, backgroundColor: '#D4A028', opacity: 0.10, bottom: 120, left: -60 },
  blobC: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#4A9060', opacity: 0.09, bottom: 320, right: 10 },
  profileRoot: { flex: 1, zIndex: 1 },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10, paddingTop: 6 },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 32, color: '#111111', letterSpacing: -0.5 },
  gearBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },

  profileScroll: { flex: 1 },
  profileScrollContent: { paddingTop: 0 },

  // Photo circles
  photoCirclesRow: { flexDirection: 'row', justifyContent: 'center', gap: 32, paddingVertical: 16 },
  photoCircleWrap: { alignItems: 'center', gap: 6 },
  photoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#C8D8CA' },
  photoCircleEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#C0D8C4', borderStyle: 'dashed' },
  photoCircleEditBadge: { position: 'absolute', bottom: 22, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  photoCircleLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: '#6A8070' },

  // Content
  contentPad: { paddingHorizontal: 16, paddingTop: 14 },
  pausedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFF8E1', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#F0C040' },
  pausedBannerText: { flex: 1, fontSize: 13, color: '#7A5C00', fontWeight: '500' },

  // Strength
  strengthSection: { backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.07)' },
  strengthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  strengthLabel: { fontFamily: fonts.bold, fontSize: 11, color: '#7A9080', letterSpacing: 0.7 },
  strengthScore: { fontFamily: fonts.bold, fontSize: 13, color: '#111111' },
  strengthBarTrack: { height: 7, backgroundColor: '#D8EAD8', borderRadius: 4, overflow: 'hidden' },
  strengthBarFill: { height: '100%', backgroundColor: '#111111', borderRadius: 4 },
  strengthHint: { fontFamily: fonts.regular, fontSize: 12, color: '#6A8070', marginTop: 7 },

  // Info chips
  infoChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  infoPill: { backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  infoPillText: { fontFamily: fonts.semiBold, fontSize: 13, color: '#111111' },

  // Section blocks
  sectionBlock: { backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.07)' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 11, color: '#7A9080', letterSpacing: 0.7 },
  sectionEditLink: { fontFamily: fonts.semiBold, fontSize: 13, color: '#111111' },
  sectionHeading: { fontFamily: fonts.bold, fontSize: 18, color: '#111111', marginBottom: 10, letterSpacing: -0.3 },
  bioText: { fontFamily: fonts.regular, fontSize: 16, color: '#111111', lineHeight: 23 },

  // Vibes
  vibesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vibeChip: { backgroundColor: '#111111', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  vibeChipText: { fontFamily: fonts.semiBold, fontSize: 13, color: '#FFFFFF' },
  vibeAddBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.15)' },
  vibeAddText: { fontFamily: fonts.semiBold, fontSize: 13, color: '#6A8070' },

  // Prompt display
  promptCountBadge: { fontFamily: fonts.semiBold, fontSize: 13, color: '#8AA89A' },
  promptViewCard: { backgroundColor: 'rgba(230,244,232,0.85)', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  promptViewQ: { fontFamily: fonts.bold, fontSize: 10, color: '#7A9A80', letterSpacing: 0.6, marginBottom: 4 },
  promptViewA: { fontFamily: fonts.regular, fontSize: 15, color: '#111111', lineHeight: 21 },
  addPromptDashed: { borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.12)', borderStyle: 'dashed', paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  addPromptDashedText: { fontFamily: fonts.semiBold, fontSize: 14, color: '#8AA89A' },

  // Stats
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 16, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.07)', overflow: 'hidden' },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 12 },
  statNum: { fontFamily: fonts.extraBold, fontSize: 26, color: '#111111', letterSpacing: -0.5 },
  statLabel: { fontFamily: fonts.bold, fontSize: 10, color: '#8AA89A', letterSpacing: 0.6, marginTop: 2 },

  // Preview button
  previewBtn: { backgroundColor: '#111111', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 22, gap: 12 },
  previewBtnTitle: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF', letterSpacing: -0.2 },
  previewBtnSub: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Account menu
  accountSectionLabel: { fontFamily: fonts.bold, fontSize: 11, color: '#7A9080', letterSpacing: 0.7, marginBottom: 8 },
  accountMenu: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16, overflow: 'hidden', marginBottom: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.07)' },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  menuIconBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EAF4EE', alignItems: 'center', justifyContent: 'center' },
  menuIconBadgeDestructive: { backgroundColor: '#FEF0F0' },
  menuLabel: { fontFamily: fonts.semiBold, fontSize: 15, color: '#111111' },
  menuLabelDestructive: { color: '#D4183D' },
  menuSub: { fontFamily: fonts.regular, fontSize: 12, color: '#8AA89A', marginTop: 1 },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.07)', marginLeft: 62 },
  footerText: { fontFamily: fonts.regular, fontSize: 12, color: '#9AAAA0', textAlign: 'center', marginBottom: 8 },

  // Editor modal
  editorModalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  editorSheet: { flex: 1, maxHeight: '88%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 16 },
  editorHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  editorHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  editorTitle: { fontFamily: fonts.bold, fontSize: 17, color: '#111111' },
  editorScroll: { flex: 1 },
  editorScrollContent: { padding: 18, paddingBottom: 36 },

  // Photo editing
  photoEditHeading: { fontFamily: fonts.extraBold, fontSize: 20, color: '#111111', letterSpacing: -0.4, marginBottom: 4 },
  photoEditSub: { fontFamily: fonts.regular, fontSize: 13, color: '#8AA89A', marginBottom: 16 },
  photoEditGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoEditThumb: { position: 'relative', borderRadius: 14, overflow: 'hidden', width: '47.5%', aspectRatio: 3 / 4 },
  photoEditThumbImg: { width: '100%', height: '100%', backgroundColor: '#C8D8CA' },
  photoEditRemoveBtn: { position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  photoEditMainBadge: { position: 'absolute', bottom: 7, left: 7, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 },
  photoEditMainBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: '#fff', letterSpacing: 0.3 },
  photoEditAddBtn: { width: '47.5%', aspectRatio: 3 / 4, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(106,128,112,0.4)', backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoEditAddText: { fontFamily: fonts.semiBold, fontSize: 12, color: '#6A8070' },
  photoEditEmpty: { width: '100%', borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.12)', backgroundColor: '#F4F7F4', alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24, marginTop: 8, gap: 8 },
  photoEditEmptyTitle: { fontFamily: fonts.semiBold, fontSize: 16, color: '#111111' },
  photoEditEmptyHint: { fontFamily: fonts.regular, fontSize: 13, color: '#8AA89A', textAlign: 'center', lineHeight: 18 },

  // Edit chips
  prefSectionSub: { fontSize: 13, color: '#6A8070', marginBottom: 14 },
  catBlock: { marginBottom: 8, backgroundColor: '#F4F7F4', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#D9E8D9' },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  catLabel: { fontFamily: fonts.semiBold, fontSize: 15, color: '#111111' },
  catChevron: { fontSize: 12, color: '#6A8070' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FDFDFD', borderWidth: 1.5, borderColor: '#D9E8D9' },
  chipOn: { backgroundColor: '#111111', borderColor: '#111111' },
  chipDim: { opacity: 0.4 },
  chipText: { fontFamily: fonts.semiBold, fontSize: 13, color: '#6A8070' },
  chipTextOn: { color: '#FFFFFF' },
  dbRow: { marginBottom: 16 },
  dbLabel: { fontFamily: fonts.semiBold, fontSize: 15, color: '#111111', marginBottom: 8 },
  dbBtns: { flexDirection: 'row', gap: 8 },
  dbBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#F4F7F4', borderWidth: 1.5, borderColor: '#D9E8D9' },
  dbBtnHard: { backgroundColor: '#E53E3E', borderColor: '#E53E3E' },
  dbBtnSoft: { backgroundColor: '#F6AD55', borderColor: '#F6AD55' },
  dbBtnNone: { backgroundColor: '#111111', borderColor: '#111111' },
  dbBtnText: { fontSize: 13, fontWeight: '500', color: '#6A8070' },
  dbBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },
  promptBlock: { backgroundColor: '#F4F7F4', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#D9E8D9' },
  promptPickerList: { borderRadius: 8, overflow: 'hidden', marginBottom: 10, backgroundColor: '#FDFDFD', borderWidth: 1, borderColor: '#D9E8D9' },
  promptPickerItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9E8D9' },
  promptPickerText: { fontSize: 14, color: '#111111' },
  promptQuestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9E8D9' },
  promptQuestionText: { flex: 1, fontFamily: fonts.semiBold, fontSize: 14, color: '#111111', lineHeight: 20 },
  promptQuestionPlaceholder: { color: '#9AA', fontWeight: '400' },
  promptQuestionEdit: { fontSize: 16, color: '#6A8070', marginLeft: 8 },
  promptAnswerInput: { fontSize: 15, color: '#111111', minHeight: 60, maxHeight: 120, paddingVertical: 4, paddingHorizontal: 0, textAlignVertical: 'top', marginBottom: 10 },
  promptRemove: { fontSize: 13, color: '#E85D4C', fontFamily: fonts.semiBold, alignSelf: 'flex-end' },
  addPromptBtn: { backgroundColor: '#FDFDFD', borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#D9E8D9', borderStyle: 'dashed' },
  addPromptBtnText: { fontFamily: fonts.semiBold, fontSize: 15, color: '#111111' },
  accordionSaveBtn: { marginTop: 16, backgroundColor: '#111111', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  accordionSaveBtnText: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' },
  basicsLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: '#6A8070', marginTop: 16, marginBottom: 8 },
  basicsOptional: { fontSize: 12, fontWeight: '400', color: '#8AA89A' },
  basicsTextInput: { backgroundColor: '#F4F7F4', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9E8D9', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111111', minHeight: 80, textAlignVertical: 'top' },

  // Stubs for modal children (SettingsModal / ListingModal / EditNameModal pass styles={styles})
  nameFieldLabel: { fontSize: 14, fontFamily: fonts.semiBold, color: '#111111', marginBottom: 8 },
  nameInput: { backgroundColor: '#F4F7F4', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9E8D9', paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#111111' },
  nameFieldHint: { fontSize: 13, color: '#8AA89A', marginTop: 14, lineHeight: 19 },
  settingsModalRoot: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 8 },
  settingsScroll: { flex: 1 },
  settingsScrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  settingsSectionLabel: { fontSize: 12, fontFamily: fonts.bold, color: '#8AA89A', textTransform: 'uppercase', letterSpacing: 0.55, marginTop: 22, marginBottom: 8 },
  settingsGroup: { backgroundColor: '#F4F7F4', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9E8D9', overflow: 'hidden', paddingVertical: 4, paddingHorizontal: 14, paddingBottom: 12 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  settingsRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingsRowTitle: { fontSize: 16, fontWeight: '500', color: '#111111' },
  settingsRowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#D9E8D9', marginLeft: 32 },
  settingsListingSummary: { paddingTop: 8, paddingBottom: 4 },
  settingsListingTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: '#111111' },
  settingsListingMeta: { fontSize: 15, fontFamily: fonts.bold, color: '#111111', marginTop: 4 },
  settingsListingSub: { fontSize: 13, color: '#8AA89A', marginTop: 4 },
  settingsInfoRow: { paddingVertical: 10 },
  settingsInfoLabel: { fontSize: 12, color: '#8AA89A', fontFamily: fonts.bold, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  settingsInfoValue: { fontSize: 16, color: '#111111' },
  settingsInviteHelp: { fontSize: 14, color: '#8AA89A', lineHeight: 20, marginBottom: 12, marginTop: 4 },
  settingsPlaceholderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  settingsPlaceholderTitle: { fontSize: 16, fontWeight: '500', color: '#8AA89A' },
  soonBadge: { fontSize: 12, fontFamily: fonts.bold, color: '#8AA89A', backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  referralCodeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9E8D9', marginBottom: 16 },
  referralCodeText: { fontSize: 20, fontFamily: fonts.extraBold, letterSpacing: 2, color: '#111111' },
  referralCopyBtn: { backgroundColor: '#111111', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  referralCopyBtnText: { color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 14 },
  inviteLabel: { fontSize: 12, color: '#8AA89A', fontFamily: fonts.bold, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  referralInput: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9E8D9', backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: '#111111', marginBottom: 10 },
  referralApplyBtn: { backgroundColor: '#111111', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  upgradeButton: { marginTop: 4, backgroundColor: '#FDFDFD', borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#46BD7F' },
  upgradeButtonText: { color: '#189AA2', fontSize: 16, fontWeight: '600' },
  manageSubButton: { marginTop: 10, paddingVertical: 12, alignItems: 'center' },
  manageSubButtonText: { color: '#0C5389', fontSize: 15, fontWeight: '600' },
  referralApplyBtnDim: { opacity: 0.65 },
  referralApplyBtnText: { color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 16 },
  inviteLinked: { fontSize: 14, color: '#8AA89A', fontFamily: fonts.bold },
  signOutButton: { marginTop: 16, backgroundColor: '#F4F7F4', borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9E8D9' },
  signOutButtonText: { color: '#111111', fontSize: 16, fontWeight: '600' },
  modalRoot: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9E8D9' },
  modalTitle: { fontSize: 17, fontFamily: fonts.semiBold, color: '#111111' },
  modalCancel: { fontSize: 17, color: '#8AA89A', width: 72 },
  modalSave: { fontSize: 17, fontFamily: fonts.semiBold, color: '#111111', width: 72, textAlign: 'right' },
  modalScroll: { flex: 1 },
  modalScrollContent: { padding: 20, paddingBottom: 40 },
  photosModalContent: { padding: 20, paddingBottom: 40 },
  listingFieldLabel: { fontSize: 13, fontFamily: fonts.bold, color: '#8AA89A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  listingInput: { backgroundColor: '#F4F7F4', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9E8D9', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111111' },
  devButton: { marginTop: 12, backgroundColor: '#FF6B00', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  devButtonText: { color: '#FDFDFD', fontSize: 14, fontFamily: fonts.bold },
});
