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
  Animated,
  PanResponder,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { usePurchases } from '../context/PurchasesContext';
import { formatPlanLabel, SUBSCRIPTION_TIER_PREMIUM } from '../lib/purchasesConfig';
import { supabase } from '../lib/supabase';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getProfileImageUrls, getProfileImageUrl, pickImage, uploadListingPhoto, pickListingImage } from '../lib/storage';
import { getPreferences, savePreferences, type Preferences } from '../lib/preferences';
import { formatLocationLine, profilePhotoPathsFromRow } from '../lib/profileDisplay';
import { appendProfilePhoto, removeProfilePhotoAt, replaceProfilePhotoAt, MAX_PROFILE_PHOTOS } from '../lib/profilePhotos';
import PublicProfileCard from '../components/PublicProfileCard';
import * as Clipboard from 'expo-clipboard';
import { redeemReferralCode, redeemErrorMessage } from '../lib/referrals';
import { getListing, saveListing, deleteListing, type Listing } from '../lib/listings';
import ProfileOverviewSection from './profile/ProfileOverviewSection';
import ListingModal from './profile/ListingModal';
import SettingsModal from './profile/SettingsModal';
import BlockedUsersModal from '../components/BlockedUsersModal';
import EditNameModal from './profile/EditNameModal';
import {
  DEALBREAKER_ITEMS,
  FILM_STRIP_GAP,
  FILM_STRIP_HEIGHT_FACTOR,
  INTEREST_CATEGORIES,
  MAX_LISTING_PHOTOS,
  PROMPTS,
} from './profile/userProfileConstants';
import {
  formatMoveInDateForInput,
  normalizeCity,
  normalizeMoveInDate,
  normalizeState,
  normalizeZip,
  validateListingLocation,
  validateMoveInDate,
} from './profile/listingFormUtils';

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
  /** Light veil on top of the sheet BlurView — keeps text readable while staying glassy. */
  sheetGlassOverlay: 'rgba(242, 244, 248, 0.44)',
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
  /** Pull dock flush with tab bar — tab scenes often leave a gap above the bar. */
  const profileSheetDockBottom = -Math.min(insets.bottom + 18, 36);
  const { width: windowWidth } = useWindowDimensions();
  /** Overlapping strip: portrait width + height (not square). */
  const { filmThumbWidth, filmThumbHeight } = useMemo(() => {
    const scrollPad = 14 * 2;
    const accordionPad = 2 * 2;
    const inner = windowWidth - scrollPad - accordionPad;
    const w = Math.max(76, Math.min(102, Math.floor(inner * 0.27)));
    const h = Math.round(w * FILM_STRIP_HEIGHT_FACTOR);
    return { filmThumbWidth: w, filmThumbHeight: h };
  }, [windowWidth]);
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
  const [isPaused, setIsPaused] = useState(false);
  const [blockedUsersOpen, setBlockedUsersOpen] = useState(false);
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

  // Edit basics state
  const [editBio, setEditBio] = useState('');
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
  const [editAddress, setEditAddress] = useState('');
  const [editListingCity, setEditListingCity] = useState('');
  const [editListingState, setEditListingState] = useState('');
  const [editListingZip, setEditListingZip] = useState('');
  const [editMoveInDate, setEditMoveInDate] = useState('');
  const [editListingPhotos, setEditListingPhotos] = useState<ListingPhotoItem[]>([]);

  const [editName, setEditName] = useState('');

  const windowDims = Dimensions.get('window');
  /** Expanded sheet height when swiped up (peek stays small). */
  const SHEET_EXPANDED_HEIGHT = Math.round(windowDims.height * 0.7);
  /** Collapsed strip height — solid header only (no blur), so the card photo doesn’t bleed through. */
  const SHEET_PEEK_HEIGHT = 88;
  const SHEET_COLLAPSED_OFFSET = Math.max(0, SHEET_EXPANDED_HEIGHT - SHEET_PEEK_HEIGHT);

  const sheetTranslateY = useRef(new Animated.Value(SHEET_COLLAPSED_OFFSET)).current;
  const sheetDragStart = useRef(SHEET_COLLAPSED_OFFSET);
  const sheetYCurrent = useRef(SHEET_COLLAPSED_OFFSET);

  /** Accordion intro + body only make sense when the sheet is expanded (not the collapsed grab strip). */
  const [profileSheetExpanded, setProfileSheetExpanded] = useState(false);
  useEffect(() => {
    const id = sheetTranslateY.addListener(({ value }) => {
      setProfileSheetExpanded(value < SHEET_COLLAPSED_OFFSET / 2);
    });
    return () => {
      sheetTranslateY.removeListener(id);
    };
  }, [SHEET_COLLAPSED_OFFSET, sheetTranslateY]);

  const snapSheetTarget = useCallback(
    (y: number, velocityY: number) => {
      if (velocityY < -0.45) return 0;
      if (velocityY > 0.45) return SHEET_COLLAPSED_OFFSET;
      return y < SHEET_COLLAPSED_OFFSET / 2 ? 0 : SHEET_COLLAPSED_OFFSET;
    },
    [SHEET_COLLAPSED_OFFSET]
  );

  const sheetHandlePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 0.75,
        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation((v) => {
            sheetDragStart.current = v;
            sheetYCurrent.current = v;
          });
        },
        onPanResponderMove: (_, g) => {
          const next = Math.max(
            0,
            Math.min(SHEET_COLLAPSED_OFFSET, sheetDragStart.current + g.dy)
          );
          sheetYCurrent.current = next;
          sheetTranslateY.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          const target = snapSheetTarget(sheetYCurrent.current, g.vy);
          sheetYCurrent.current = target;
          Animated.spring(sheetTranslateY, {
            toValue: target,
            useNativeDriver: true,
            tension: 300,
            friction: 34,
          }).start();
        },
      }),
    [SHEET_COLLAPSED_OFFSET, sheetTranslateY, snapSheetTarget]
  );

  const togglePersonalitySheet = useCallback(() => {
    sheetTranslateY.stopAnimation((v) => {
      const target = v < SHEET_COLLAPSED_OFFSET / 2 ? SHEET_COLLAPSED_OFFSET : 0;
      sheetYCurrent.current = target;
      Animated.spring(sheetTranslateY, {
        toValue: target,
        useNativeDriver: true,
        tension: 300,
        friction: 34,
      }).start();
    });
  }, [SHEET_COLLAPSED_OFFSET, sheetTranslateY]);

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
    setEditAddress(listing?.address ?? '');
    setEditListingCity(String(listing?.city ?? prefs?.city ?? '').trim());
    setEditListingState(String(listing?.state ?? prefs?.state ?? '').trim());
    setEditListingZip(String(listing?.zip_code ?? prefs?.zip_code ?? '').trim());
    setEditMoveInDate(formatMoveInDateForInput(listing?.move_in_date));
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
    let normalizedCity = normalizeCity(editListingCity);
    let normalizedState = normalizeState(editListingState);
    let normalizedZip = normalizeZip(editListingZip.trim());
    if (!normalizedCity && prefs?.city) normalizedCity = normalizeCity(String(prefs.city));
    if (!normalizedState && prefs?.state) normalizedState = normalizeState(String(prefs.state));
    if (!normalizedZip && prefs?.zip_code) normalizedZip = normalizeZip(String(prefs.zip_code));

    const locationError = validateListingLocation(normalizedCity, normalizedState, normalizedZip);
    if (locationError) {
      Alert.alert('Invalid location', locationError);
      return;
    }
    const normalizedMoveInDate = normalizeMoveInDate(editMoveInDate.trim());
    const moveInDateError = validateMoveInDate(normalizedMoveInDate);
    if (moveInDateError) {
      Alert.alert('Invalid date', moveInDateError);
      return;
    }

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
        city: normalizedCity || null,
        state: normalizedState || null,
        zip_code: normalizedZip || null,
        move_in_date: normalizedMoveInDate || null,
        listing_photos: photoPaths,
      });
      if (!result.ok) { Alert.alert('Error', result.error); return; }
      setEditListingCity(normalizedCity);
      setEditListingState(normalizedState);
      setEditListingZip(normalizedZip);
      setEditMoveInDate(normalizedMoveInDate);
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
      <View style={[styles.profileRoot, { paddingTop: 8 + insets.top }]}>
        {user && (
          <KeyboardAvoidingView
            style={styles.profileKeyboardRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 72 : 0}
          >
            <View style={styles.profileStage}>
              <ScrollView
                style={styles.profileScroll}
                contentContainerStyle={[
                  styles.profileScrollContent,
                  { paddingBottom: SHEET_PEEK_HEIGHT + Math.max(insets.bottom, 16) + 16 },
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.headerRow}>
                  <View style={styles.headerTitleBlock}>
                    <Text style={styles.titleOnGreen}>Profile</Text>
                    <Text style={styles.taglineOnGreen}>Swipe up to adjust your profile</Text>
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

                <View style={styles.profilePhotoStage}>
                  <View style={styles.profileHeroWrap}>
                    <PublicProfileCard
                      variant="profilePhotos"
                      imageUrls={imageUrls}
                      name={displayName}
                      age={displayAge}
                      location={formatLocationLine(prefs)}
                      bio=""
                      hobbies={[]}
                    />
                  </View>
                </View>

                {isPaused && (
                  <View style={styles.pausedBanner}>
                    <Ionicons name="pause-circle-outline" size={16} color="#7A5C00" />
                    <Text style={styles.pausedBannerText}>
                      Your profile is paused — you won't appear in discover
                    </Text>
                  </View>
                )}

                <ProfileOverviewSection
                  displayName={displayName}
                  displayAge={displayAge}
                  profileHobbies={profileHobbies}
                  profileInterests={profileInterests}
                  listing={listing}
                  searchLocationLine={listingSearchLocationLine}
                  listingPhotoUrls={listingPhotoUrls}
                  prompts={profilePromptsForOverview}
                />
              </ScrollView>

              <Animated.View
                style={[
                  styles.personalitySheet,
                  {
                    height: SHEET_EXPANDED_HEIGHT + Math.max(insets.bottom, 10),
                    bottom: profileSheetDockBottom,
                    transform: [{ translateY: sheetTranslateY }],
                  },
                ]}
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 52 : 32}
                  tint={Platform.OS === 'ios' ? 'systemThinMaterialLight' : 'light'}
                  {...(Platform.OS === 'android'
                    ? { experimentalBlurMethod: 'dimezisBlurView' as const }
                    : {})}
                  style={styles.sheetBlur}
                  pointerEvents="none"
                />
                <View style={styles.sheetGlassTint} pointerEvents="none" />
                {/* Handle fills the peek height so ScrollView content never shows when collapsed */}
                <View
                  style={[styles.sheetHandleSolid, { minHeight: SHEET_PEEK_HEIGHT }]}
                  {...sheetHandlePan.panHandlers}
                >
                  <Pressable
                    onPress={togglePersonalitySheet}
                    accessibilityRole="button"
                    accessibilityLabel="Expand or collapse Adjust profile"
                    style={({ pressed }) => [styles.sheetGrabRow, pressed && { opacity: 0.92 }]}
                  >
                    <View style={styles.sheetHandlePill} />
                    <Text style={styles.sheetGrabTitle}>Adjust profile</Text>
                    <Ionicons
                      name={profileSheetExpanded ? 'chevron-down' : 'chevron-up'}
                      size={18}
                      color="rgba(26, 26, 30, 0.72)"
                    />
                  </Pressable>
                </View>
                <View style={styles.personalitySheetBody}>
                  <ScrollView
                    style={styles.personalitySheetScroll}
                    contentContainerStyle={[
                      styles.personalitySheetScrollContent,
                      { paddingBottom: 52 + Math.max(insets.bottom, 12) },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled
                  >
                    {profileSheetExpanded ? (
                      <>
                    <Text style={styles.accordionHint}>Tap a row — sections drop down below</Text>

                    <TouchableOpacity
                  style={[
                    styles.accordionRow,
                    profileEditorSection === 'photos' && styles.accordionRowOpen,
                  ]}
                  onPress={() => activateProfileSection('photos')}
                  activeOpacity={0.85}
                >
                  <View style={styles.accordionRowLeft}>
                    <Ionicons name="images-outline" size={22} color={theme.foreground} />
                    <Text style={styles.accordionRowLabel}>Photos</Text>
                  </View>
                  <Ionicons
                    name={profileEditorSection === 'photos' ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color='rgba(26, 26, 30, 0.72)'
                  />
                </TouchableOpacity>
                {profileEditorSection === 'photos' ? (
                  <View style={styles.accordionBody}>
                    {savingPhotos ? (
                      <ActivityIndicator style={{ marginVertical: 16 }} color={theme.primary} />
                    ) : null}
                    <View style={styles.photoEditLayout}>
                      {imageUrls.length === 0 ? (
                        <TouchableOpacity
                          style={styles.coverEmpty}
                          onPress={handleAddPhoto}
                          disabled={savingPhotos}
                          activeOpacity={0.88}
                          accessibilityRole="button"
                          accessibilityLabel="Add main photo"
                        >
                          <Ionicons name="image-outline" size={40} color={theme.mutedForeground} />
                          <Text style={styles.coverEmptyTitle}>Add main photo</Text>
                          <Text style={styles.coverEmptyHint}>
                            Up to {MAX_PROFILE_PHOTOS} photos — extras overlap below
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <>
                          <Pressable
                            style={({ pressed }) => [
                              styles.coverHero,
                              pressed && styles.coverHeroPressed,
                            ]}
                            onPress={() => handleRemovePhoto(0)}
                            disabled={savingPhotos}
                            accessibilityRole="button"
                            accessibilityLabel="Main photo, tap to edit"
                          >
                            <Image source={{ uri: imageUrls[0] }} style={styles.coverImage} />
                            <View style={styles.mainPhotoPill} pointerEvents="none">
                              <Text style={styles.mainPhotoPillText}>Main</Text>
                            </View>
                          </Pressable>

                          <ScrollView
                            horizontal
                            nestedScrollEnabled
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            style={styles.photoFilmScroll}
                            contentContainerStyle={styles.photoFilmScrollContent}
                          >
                            {imageUrls.slice(1).map((url, index) => {
                              const realIndex = index + 1;
                              return (
                                <Pressable
                                  key={`film-${realIndex}-${url}`}
                                  style={({ pressed }) => [
                                    styles.photoFilmCell,
                                    {
                                      width: filmThumbWidth,
                                      height: filmThumbHeight,
                                    },
                                    pressed && styles.photoFilmCellPressed,
                                  ]}
                                  onPress={() => handleRemovePhoto(realIndex)}
                                  disabled={savingPhotos}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Photo ${realIndex + 1}, tap to edit`}
                                >
                                  <Image source={{ uri: url }} style={styles.photoFilmImage} />
                                </Pressable>
                              );
                            })}
                            {photoPaths.length < MAX_PROFILE_PHOTOS ? (
                              <TouchableOpacity
                                style={[
                                  styles.photoFilmCell,
                                  styles.photoFilmAdd,
                                  {
                                    width: filmThumbWidth,
                                    height: filmThumbHeight,
                                  },
                                ]}
                                onPress={handleAddPhoto}
                                disabled={savingPhotos}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel="Add photo"
                              >
                                <Ionicons name="add" size={28} color={theme.pearDark} />
                              </TouchableOpacity>
                            ) : null}
                          </ScrollView>
                        </>
                      )}
                    </View>
                  </View>
                ) : null}

                <View style={styles.accordionDivider} />

                <TouchableOpacity
                  style={[
                    styles.accordionRow,
                    profileEditorSection === 'interests' && styles.accordionRowOpen,
                  ]}
                  onPress={() => activateProfileSection('interests')}
                  activeOpacity={0.85}
                >
                  <View style={styles.accordionRowLeft}>
                    <Ionicons name="heart-outline" size={22} color={theme.foreground} />
                    <Text style={styles.accordionRowLabel}>Interests</Text>
                  </View>
                  <Ionicons
                    name={profileEditorSection === 'interests' ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color='rgba(26, 26, 30, 0.72)'
                  />
                </TouchableOpacity>
                {profileEditorSection === 'interests' ? (
                  <View style={styles.accordionBody}>
                    <Text style={styles.prefSectionSub}>Select up to 5 per category</Text>
                    {INTEREST_CATEGORIES.map((cat) => {
                      const selected = editInterests[cat.key] ?? [];
                      const isCatExpanded = expandedPrefCat === cat.key;
                      return (
                        <View key={cat.key} style={styles.catBlock}>
                          <TouchableOpacity
                            style={styles.catHeader}
                            onPress={() => setExpandedPrefCat(isCatExpanded ? null : cat.key)}
                          >
                            <Text style={styles.catLabel}>
                              {cat.label} {selected.length > 0 ? `(${selected.length})` : ''}
                            </Text>
                            <Text style={styles.catChevron}>{isCatExpanded ? '▲' : '▼'}</Text>
                          </TouchableOpacity>
                          {isCatExpanded ? (
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
                                        return {
                                          ...prev,
                                          [cat.key]: on ? cur.filter((x) => x !== opt) : [...cur, opt],
                                        };
                                      });
                                    }}
                                  >
                                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                    <TouchableOpacity
                      style={styles.accordionSaveBtn}
                      onPress={handleSavePrefs}
                      disabled={savingPrefs}
                      activeOpacity={0.85}
                    >
                      {savingPrefs ? (
                        <ActivityIndicator color={theme.primaryForeground} />
                      ) : (
                        <Text style={styles.accordionSaveBtnText}>Save interests</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={styles.accordionDivider} />

                <TouchableOpacity
                  style={[
                    styles.accordionRow,
                    profileEditorSection === 'dealbreakers' && styles.accordionRowOpen,
                  ]}
                  onPress={() => activateProfileSection('dealbreakers')}
                  activeOpacity={0.85}
                >
                  <View style={styles.accordionRowLeft}>
                    <Ionicons name="shield-outline" size={22} color={theme.foreground} />
                    <Text style={styles.accordionRowLabel}>Dealbreakers</Text>
                  </View>
                  <Ionicons
                    name={profileEditorSection === 'dealbreakers' ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color='rgba(26, 26, 30, 0.72)'
                  />
                </TouchableOpacity>
                {profileEditorSection === 'dealbreakers' ? (
                  <View style={styles.accordionBody}>
                    {DEALBREAKER_ITEMS.map((item) => {
                      const val = editDealbreakers[item.key] ?? 'none';
                      return (
                        <View key={item.key} style={styles.dbRow}>
                          <Text style={styles.dbLabel}>{item.label}</Text>
                          <View style={styles.dbBtns}>
                            {([
                              { lvl: 'hard', label: 'Never' },
                              { lvl: 'soft', label: 'Prefer not' },
                              { lvl: 'none', label: "Fine" },
                            ] as { lvl: DealbreakerLevel; label: string }[]).map(({ lvl, label }) => (
                              <TouchableOpacity
                                key={lvl}
                                style={[
                                  styles.dbBtn,
                                  val === lvl && (
                                    lvl === 'hard' ? styles.dbBtnHard
                                    : lvl === 'soft' ? styles.dbBtnSoft
                                    : styles.dbBtnNone
                                  ),
                                ]}
                                onPress={() =>
                                  setEditDealbreakers((prev) => ({ ...prev, [item.key]: lvl }))
                                }
                              >
                                <Text style={[styles.dbBtnText, val === lvl && styles.dbBtnTextActive]}>
                                  {label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      );
                    })}
                    <TouchableOpacity
                      style={styles.accordionSaveBtn}
                      onPress={handleSavePrefs}
                      disabled={savingPrefs}
                      activeOpacity={0.85}
                    >
                      {savingPrefs ? (
                        <ActivityIndicator color={theme.primaryForeground} />
                      ) : (
                        <Text style={styles.accordionSaveBtnText}>Save dealbreakers</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={styles.accordionDivider} />

                <TouchableOpacity
                  style={[
                    styles.accordionRow,
                    profileEditorSection === 'prompts' && styles.accordionRowOpen,
                  ]}
                  onPress={() => activateProfileSection('prompts')}
                  activeOpacity={0.85}
                >
                  <View style={styles.accordionRowLeft}>
                    <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.foreground} />
                    <Text style={styles.accordionRowLabel}>Prompts</Text>
                  </View>
                  <Ionicons
                    name={profileEditorSection === 'prompts' ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color='rgba(26, 26, 30, 0.72)'
                  />
                </TouchableOpacity>
                {profileEditorSection === 'prompts' ? (
                  <View style={styles.accordionBody}>
                    <Text style={styles.prefSectionSub}>Pick up to 3 prompts and answer them.</Text>

                    {editPrompts.map((entry, idx) => (
                      <View key={idx} style={styles.promptBlock}>
                        {promptPickerIndex === idx ? (
                          <View style={styles.promptPickerList}>
                            {PROMPTS.filter(
                              (p) => !editPrompts.some((e, i) => i !== idx && e.question === p)
                            ).map((p) => (
                              <TouchableOpacity
                                key={p}
                                style={styles.promptPickerItem}
                                onPress={() => {
                                  setEditPrompts((prev) =>
                                    prev.map((e, i) => (i === idx ? { ...e, question: p } : e))
                                  );
                                  setPromptPickerIndex(null);
                                }}
                              >
                                <Text style={styles.promptPickerText}>{p}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.promptQuestion}
                            onPress={() => setPromptPickerIndex(idx)}
                          >
                            <Text
                              style={[
                                styles.promptQuestionText,
                                !entry.question && styles.promptQuestionPlaceholder,
                              ]}
                            >
                              {entry.question || 'Tap to choose a prompt…'}
                            </Text>
                            <Text style={styles.promptQuestionEdit}>✎</Text>
                          </TouchableOpacity>
                        )}
                        <TextInput
                          style={styles.promptAnswerInput}
                          value={entry.answer}
                          onChangeText={(t) =>
                            setEditPrompts((prev) =>
                              prev.map((e, i) => (i === idx ? { ...e, answer: t } : e))
                            )
                          }
                          placeholder="Your answer…"
                          placeholderTextColor="#9AA"
                          multiline
                          maxLength={300}
                        />
                        <TouchableOpacity onPress={() => setEditPrompts((prev) => prev.filter((_, i) => i !== idx))}>
                          <Text style={styles.promptRemove}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    {editPrompts.length < 3 ? (
                      <TouchableOpacity
                        style={styles.addPromptBtn}
                        onPress={() => setEditPrompts((prev) => [...prev, { question: '', answer: '' }])}
                      >
                        <Text style={styles.addPromptBtnText}>+ Add prompt</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={styles.accordionSaveBtn}
                      onPress={handleSavePrompts}
                      disabled={savingPrompts}
                      activeOpacity={0.85}
                    >
                      {savingPrompts ? (
                        <ActivityIndicator color={theme.primaryForeground} />
                      ) : (
                        <Text style={styles.accordionSaveBtnText}>Save prompts</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={styles.accordionDivider} />

                <TouchableOpacity
                  style={[
                    styles.accordionRow,
                    profileEditorSection === 'basics' && styles.accordionRowOpen,
                  ]}
                  onPress={() => activateProfileSection('basics')}
                  activeOpacity={0.85}
                >
                  <View style={styles.accordionRowLeft}>
                    <Ionicons name="person-outline" size={22} color={theme.foreground} />
                    <Text style={styles.accordionRowLabel}>About Me</Text>
                  </View>
                  <Ionicons
                    name={profileEditorSection === 'basics' ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color='rgba(26, 26, 30, 0.72)'
                  />
                </TouchableOpacity>
                {profileEditorSection === 'basics' ? (
                  <View style={styles.accordionBody}>
                    {/* Bio */}
                    <Text style={styles.basicsLabel}>Bio</Text>
                    <TextInput
                      style={styles.basicsTextInput}
                      value={editBio}
                      onChangeText={setEditBio}
                      placeholder="Tell future roommates about yourself…"
                      placeholderTextColor={theme.mutedForeground}
                      multiline
                      maxLength={300}
                    />

                    {/* Gender */}
                    <Text style={styles.basicsLabel}>Gender</Text>
                    <View style={styles.chipsWrap}>
                      {['Man', 'Woman', 'Non-binary', 'Other', 'Prefer not to say'].map((g) => (
                        <TouchableOpacity
                          key={g}
                          style={[styles.chip, editGender === g && styles.chipOn]}
                          onPress={() => setEditGender(editGender === g ? '' : g)}
                        >
                          <Text style={[styles.chipText, editGender === g && styles.chipTextOn]}>{g}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Ethnicity */}
                    <Text style={styles.basicsLabel}>Ethnicity <Text style={styles.basicsOptional}>(optional)</Text></Text>
                    <View style={styles.chipsWrap}>
                      {[
                        'Asian', 'Black / African American', 'Hispanic / Latino',
                        'Middle Eastern', 'Native American', 'Pacific Islander',
                        'White / Caucasian', 'Multiracial', 'Prefer not to say',
                      ].map((e) => (
                        <TouchableOpacity
                          key={e}
                          style={[styles.chip, editEthnicity === e && styles.chipOn]}
                          onPress={() => setEditEthnicity(editEthnicity === e ? '' : e)}
                        >
                          <Text style={[styles.chipText, editEthnicity === e && styles.chipTextOn]}>{e}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Work schedule */}
                    <Text style={styles.basicsLabel}>Work Schedule</Text>
                    <View style={styles.chipsWrap}>
                      {[
                        { val: '9-to-5', label: '9 to 5' },
                        { val: 'Remote', label: 'Remote / WFH' },
                        { val: 'Night Shift', label: 'Night Shift' },
                        { val: 'Flexible', label: 'Flexible' },
                      ].map(({ val, label }) => (
                        <TouchableOpacity
                          key={val}
                          style={[styles.chip, editWorkSchedule === val && styles.chipOn]}
                          onPress={() => setEditWorkSchedule(editWorkSchedule === val ? '' : val)}
                        >
                          <Text style={[styles.chipText, editWorkSchedule === val && styles.chipTextOn]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Social vibe */}
                    <Text style={styles.basicsLabel}>Social Vibe</Text>
                    <View style={styles.chipsWrap}>
                      {['Social Butterfly', 'Balanced', 'Homebody'].map((v) => (
                        <TouchableOpacity
                          key={v}
                          style={[styles.chip, editSocialPref === v && styles.chipOn]}
                          onPress={() => setEditSocialPref(editSocialPref === v ? '' : v)}
                        >
                          <Text style={[styles.chipText, editSocialPref === v && styles.chipTextOn]}>{v}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Cleanliness */}
                    <Text style={styles.basicsLabel}>Cleanliness <Text style={styles.basicsOptional}>(1 = relaxed · 5 = spotless)</Text></Text>
                    <View style={styles.chipsWrap}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <TouchableOpacity
                          key={n}
                          style={[styles.chip, editCleanliness === n && styles.chipOn]}
                          onPress={() => setEditCleanliness(editCleanliness === n ? null : n)}
                        >
                          <Text style={[styles.chipText, editCleanliness === n && styles.chipTextOn]}>{n}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={styles.accordionSaveBtn}
                      onPress={handleSaveBasics}
                      disabled={savingBasics}
                      activeOpacity={0.85}
                    >
                      {savingBasics ? (
                        <ActivityIndicator color={theme.primaryForeground} />
                      ) : (
                        <Text style={styles.accordionSaveBtnText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}

                      </>
                    ) : null}
                  </ScrollView>
                </View>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>

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
        onUpgradeToPlus={() => {
          void openUpgradeIfNeeded();
        }}
        onManageSubscription={() => {
          void presentCustomerCenter();
        }}
        onDeleteAccount={handleDeleteAccount}
        onSignOut={handleSignOut}
        onDevShowOnboarding={onDevShowOnboarding}
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

      {/* ── Listing modal ── */}
      <ListingModal
        visible={listingOpen}
        listingExists={Boolean(listing)}
        savingListing={savingListing}
        editListingPhotos={editListingPhotos}
        maxListingPhotos={MAX_LISTING_PHOTOS}
        editRent={editRent}
        editRoomType={editRoomType}
        editListingCity={editListingCity}
        editListingState={editListingState}
        editListingZip={editListingZip}
        editAddress={editAddress}
        editMoveInDate={editMoveInDate}
        setEditRent={setEditRent}
        setEditRoomType={setEditRoomType}
        setEditListingCity={setEditListingCity}
        setEditListingState={setEditListingState}
        setEditListingZip={setEditListingZip}
        setEditAddress={setEditAddress}
        setEditMoveInDate={setEditMoveInDate}
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
  container: {
    flex: 1,
    backgroundColor: theme.background,
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
  profileRoot: {
    flex: 1,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  profileKeyboardRoot: {
    flex: 1,
  },
  profileStage: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  profileScroll: {
    flex: 1,
  },
  profileScrollContent: {
    paddingTop: 0,
  },
  profilePhotoStage: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  profileIdentitySection: {
    marginTop: 14,
    marginHorizontal: 16,
    paddingHorizontal: 2,
  },
  profileNameHeader: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.foreground,
    letterSpacing: -0.4,
  },
  profileAgeHeader: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '600',
    color: theme.mutedForeground,
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
  profileMetaName: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.foreground,
  },
  profileCategoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.foreground,
    marginBottom: 8,
  },
  profileCategoryLabel: {
    marginTop: 2,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: theme.mutedForeground,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  profileMetaHint: {
    marginTop: 8,
    fontSize: 13,
    color: theme.mutedForeground,
    lineHeight: 18,
  },
  profileInterestsWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileInterestChip: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  profileInterestText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.foreground,
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
    color: theme.foreground,
  },
  profileListingRent: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.foreground,
  },
  profileListingMeta: {
    marginTop: 4,
    fontSize: 13,
    color: theme.mutedForeground,
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
  sheetBlur: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetGlassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.sheetGlassOverlay,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  personalitySheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'column',
    backgroundColor: 'transparent',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.55)',
    shadowColor: '#1A2C24',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 10,
  },
  personalitySheetBody: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'transparent',
  },
  sheetHandleSolid: {
    backgroundColor: 'transparent',
    zIndex: 3,
  },
  sheetGrabRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  sheetHandlePill: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    marginBottom: 10,
  },
  sheetGrabTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.foreground,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  personalitySheetScroll: {
    flexGrow: 1,
  },
  personalitySheetScrollContent: {
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  accordionHint: {
    fontSize: 13,
    color: 'rgba(20, 20, 24, 0.82)',
    marginBottom: 10,
    lineHeight: 18,
  },
  accordionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: theme.radiusMd,
  },
  accordionRowOpen: {
    backgroundColor: 'rgba(3, 2, 19, 0.04)',
  },
  accordionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  accordionRowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.foreground,
  },
  accordionBody: {
    paddingBottom: 12,
    paddingHorizontal: 2,
  },
  accordionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.border,
    marginVertical: 2,
  },
  accordionSaveBtn: {
    marginTop: 16,
    backgroundColor: theme.primary,
    borderRadius: theme.radiusMd,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionSaveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primaryForeground,
  },
  profileHeroWrap: {
    justifyContent: 'flex-start',
    minHeight: 430,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  headerTitleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  settingsHelp: {
    fontSize: 13,
    color: theme.mutedForeground,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
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
  upgradeButton: {
    marginTop: 4,
    backgroundColor: '#FDFDFD',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#46BD7F',
  },
  upgradeButtonText: {
    color: '#189AA2',
    fontSize: 16,
    fontWeight: '600',
  },
  manageSubButton: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  manageSubButtonText: {
    color: '#0C5389',
    fontSize: 15,
    fontWeight: '600',
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
  photoEditLayout: {
    width: '100%',
  },
  coverEmpty: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: theme.radiusLg,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderStyle: 'dashed',
    backgroundColor: theme.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginBottom: 4,
  },
  coverEmptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
    color: theme.foreground,
  },
  coverEmptyHint: {
    marginTop: 6,
    fontSize: 13,
    color: theme.mutedForeground,
    textAlign: 'center',
  },
  coverHero: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.muted,
    marginBottom: 4,
    shadowColor: '#1A2C24',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  coverHeroPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  photoFilmScroll: {
    marginTop: 8,
    flexGrow: 0,
  },
  photoFilmScrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: FILM_STRIP_GAP,
    paddingBottom: 2,
    paddingRight: 4,
  },
  photoFilmCell: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.muted,
    borderWidth: 0,
    shadowColor: '#1A2C24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  photoFilmCellPressed: {
    opacity: 0.88,
  },
  photoFilmImage: {
    width: '100%',
    height: '100%',
  },
  photoFilmAdd: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(90, 107, 93, 0.38)',
    backgroundColor: 'rgba(232, 240, 234, 0.55)',
  },
  mainPhotoPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  mainPhotoPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
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
    color: 'rgba(20, 20, 24, 0.8)',
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
    color: 'rgba(20, 20, 24, 0.72)',
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
    marginBottom: 16,
  },
  dbLabel: {
    fontSize: 15,
    color: theme.foreground,
    fontWeight: '600',
    marginBottom: 8,
  },
  dbBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  dbBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F4F7F9',
    borderWidth: 1.5,
    borderColor: '#D9E1E6',
  },
  dbBtnHard: {
    backgroundColor: '#E53E3E',
    borderColor: '#E53E3E',
  },
  dbBtnSoft: {
    backgroundColor: '#F6AD55',
    borderColor: '#F6AD55',
  },
  dbBtnNone: {
    backgroundColor: '#189AA2',
    borderColor: '#189AA2',
  },
  dbBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.mutedForeground,
  },
  dbBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  pausedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F0C040',
  },
  pausedBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#7A5C00',
    fontWeight: '500',
  },
  basicsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.mutedForeground,
    marginTop: 16,
    marginBottom: 8,
  },
  basicsOptional: {
    fontSize: 12,
    fontWeight: '400',
    color: theme.mutedForeground,
  },
  basicsTextInput: {
    backgroundColor: theme.inputBackground,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.foreground,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
