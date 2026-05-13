import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Image,
  ScrollView,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  TextInput,
  Pressable,
} from 'react-native';
import DraggableSheet from '../components/DraggableSheet';
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
import { appendProfilePhoto, removeProfilePhotoAt, replaceProfilePhotoAt, reorderProfilePhoto, MAX_PROFILE_PHOTOS } from '../lib/profilePhotos';
import SwipeCard from '../components/SwipeCard';
import type { DiscoverProfile } from '../lib/discover';
import * as Clipboard from 'expo-clipboard';
import { redeemReferralCode, redeemErrorMessage } from '../lib/referrals';
import { getListing, saveListing, deleteListing, type Listing } from '../lib/listings';
import ListingModal from './profile/ListingModal';
import SettingsModal from './profile/SettingsModal';
import BlockedUsersModal from '../components/BlockedUsersModal';
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

const DB_ICON_MAP: Record<string, string> = {
  smoking: 'flame-outline',
  pets: 'paw-outline',
  parties: 'musical-notes-outline',
  early_bird: 'sunny-outline',
  night_owl: 'moon-outline',
  guests: 'people-outline',
  messy: 'trash-outline',
};
const DB_CYCLE: DealbreakerLevel[] = ['none', 'soft', 'hard'];
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

  const [nameEditing, setNameEditing] = useState(false);
  const nameInputRef = useRef<any>(null);
  const [profileEditorSection, setProfileEditorSection] = useState<
    'photos' | 'interests' | 'dealbreakers' | 'prompts' | 'basics' | null
  >(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [consolidatedEditOpen, setConsolidatedEditOpen] = useState(false);
  const [consolidatedEditTab, setConsolidatedEditTab] = useState<'basics' | 'prompts' | 'interests' | 'dealbreakers'>('basics');
  const [photoActionIndex, setPhotoActionIndex] = useState<number | null>(null);
  const [draggingPhotoIndex, setDraggingPhotoIndex] = useState<number | null>(null);
  const dragOverPhotoIndexRef = useRef<number | null>(null);
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
  const photoGridRef = useRef<View | null>(null);
  const photoGridFrameRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const photoDragRef = useRef<{ index: number; active: boolean } | null>(null);
  const photoDragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoDragOffset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const suppressPhotoPressRef = useRef(false);

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
  const listingAutoSaveReadyRef = useRef(false);

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

  const openConsolidatedEditor = useCallback((tab: 'basics' | 'prompts' | 'interests' | 'dealbreakers' = 'basics') => {
    setEditBio(profile?.bio ?? '');
    setEditOccupation(profile?.occupation ?? '');
    setEditGender(profile?.gender ?? '');
    setEditEthnicity(profile?.ethnicity ?? '');
    setEditWorkSchedule(prefs?.work_schedule ?? '');
    const sp = prefs?.social_preference;
    setEditSocialPref(sp === 'social' ? 'Social Butterfly' : sp === 'quiet' ? 'Homebody' : sp === 'balanced' ? 'Balanced' : '');
    setEditCleanliness(prefs?.cleanliness_level ?? null);
    const defaultDB = Object.fromEntries(DEALBREAKER_ITEMS.map((d) => [d.key, 'none' as DealbreakerLevel]));
    setEditInterests(prefs?.interests ?? {});
    setEditDealbreakers({ ...defaultDB, ...(prefs?.dealbreakers ?? {}) });
    const current: PromptEntry[] = Array.isArray(profile?.prompts) ? [...profile.prompts] : [];
    setEditPrompts(current.length > 0 ? current : [{ question: '', answer: '' }]);
    setPromptPickerIndex(null);
    setExpandedPrefCat('fitness');
    setConsolidatedEditTab(tab);
    setConsolidatedEditOpen(true);
  }, [profile, prefs]);

  const autoSaveProfile = useCallback(async (updates: Record<string, any>) => {
    if (!user) return;
    await supabase.from('profiles').update(updates).eq('id', user.id);
    await loadProfile(user.id);
  }, [user, loadProfile]);

  const autoSavePrefs = useCallback(async (updates: Partial<Preferences>) => {
    if (!user) return;
    await savePreferences(user.id, updates);
    const p = await getPreferences(user.id);
    setPrefs(p);
  }, [user]);

  const autoSavePrompts = useCallback(async (prompts: PromptEntry[]) => {
    if (!user) return;
    const filtered = prompts.filter((p) => p.question && p.answer.trim());
    await supabase.from('profiles').update({ prompts: filtered }).eq('id', user.id);
    await loadProfile(user.id);
  }, [user, loadProfile]);

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
    listingAutoSaveReadyRef.current = false;
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
    setTimeout(() => { listingAutoSaveReadyRef.current = true; }, 0);
  };

  const handleAddListingPhoto = async (replaceIndex?: number) => {
    if (!user || (replaceIndex == null && editListingPhotos.length >= MAX_LISTING_PHOTOS)) return;
    const uri = await pickListingImage();
    if (!uri) return;
    setSavingListing(true);
    try {
      const { path, error } = await uploadListingPhoto(user.id, uri);
      if (error || !path) {
        Alert.alert('Error', error ?? 'Photo upload failed');
        return;
      }
      const url = await getProfileImageUrl(path);
      setEditListingPhotos((prev) => {
        const item: ListingPhotoItem = { kind: 'path', path, url: url ?? uri };
        if (replaceIndex == null) return [...prev, item];
        return prev.map((existing, idx) => idx === replaceIndex ? item : existing);
      });
    } finally {
      setSavingListing(false);
    }
  };

  const autoSaveListing = useCallback(async () => {
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
      const rentValue = Number.parseFloat(editRent);
      const result = await saveListing(user.id, {
        rent: Number.isFinite(rentValue) ? rentValue : null,
        room_type: editRoomType.trim() || null,
        listing_photos: photoPaths,
      });
      if (!result.ok) { Alert.alert('Error', result.error); return; }
      await loadListing(user.id);
      await loadProfile(user.id);
    } finally {
      setSavingListing(false);
    }
  }, [editListingPhotos, editRent, editRoomType, loadListing, loadProfile, user]);

  useEffect(() => {
    if (!listingOpen || !listingAutoSaveReadyRef.current) return;
    const timer = setTimeout(() => {
      void autoSaveListing();
    }, 650);
    return () => clearTimeout(timer);
  }, [autoSaveListing, listingOpen]);

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
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email } : null);
      if (u) {
        loadProfile(u.id);
        loadListing(u.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
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

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfile, loadListing]);

  useFocusEffect(
    useCallback(() => {
      refreshCustomerInfo().catch(() => {});
      if (user?.id) {
        loadProfile(user.id);
        loadListing(user.id);
      }
    }, [refreshCustomerInfo, user?.id, loadProfile, loadListing])
  );

  const openEditName = () => {
    if (!profile) return;
    setEditName(profile.name?.trim() ?? '');
    setNameEditing(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleSaveName = async () => {
    if (!user) return;
    setNameEditing(false);
    const trimmed = editName.trim();
    if (!trimmed || trimmed === profile?.name) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: trimmed })
        .eq('id', user.id);
      if (error) { Alert.alert('Error', error.message); return; }
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

  const measurePhotoGrid = useCallback(() => {
    photoGridRef.current?.measureInWindow((x, y, width, height) => {
      photoGridFrameRef.current = { x, y, width, height };
    });
  }, []);

  const photoIndexFromPagePoint = useCallback((pageX: number, pageY: number) => {
    const frame = photoGridFrameRef.current;
    if (!frame.width || !frame.height) return null;

    const gap = 10;
    const slotW = (frame.width - gap * 2) / 3;
    const slotH = slotW / 0.78;
    const relX = pageX - frame.x;
    const relY = pageY - frame.y;
    if (relX < 0 || relY < 0 || relX > frame.width || relY > frame.height) return null;

    const col = Math.floor(relX / (slotW + gap));
    const row = Math.floor(relY / (slotH + gap));
    if (col < 0 || col > 2 || row < 0 || row > 1) return null;

    const inColX = relX - col * (slotW + gap);
    const inRowY = relY - row * (slotH + gap);
    if (inColX > slotW || inRowY > slotH) return null;

    const index = row * 3 + col;
    return index < photoPaths.length ? index : null;
  }, [photoPaths.length]);

  const handleReorderPhoto = useCallback(async (fromIndex: number, toIndex: number) => {
    if (!user || fromIndex === toIndex) return;

    const reorder = <T,>(items: T[]) => {
      const next = [...items];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    };

    setPhotoPaths((prev) => reorder(prev));
    setImageUrls((prev) => reorder(prev));
    setSavingPhotos(true);
    try {
      const result = await reorderProfilePhoto(user.id, fromIndex, toIndex);
      if (!result.ok) {
        Alert.alert('Could not reorder', result.error ?? 'Try again.');
        await loadProfile(user.id);
        return;
      }
      await loadProfile(user.id);
    } finally {
      setSavingPhotos(false);
    }
  }, [loadProfile, user]);

  const openPhotoAction = useCallback((index: number) => {
    if (savingPhotos) return;
    setPhotoActionIndex(index);
  }, [savingPhotos]);

  const setPhotoDropTarget = useCallback((index: number | null) => {
    if (dragOverPhotoIndexRef.current === index) return;
    dragOverPhotoIndexRef.current = index;
  }, []);

  const createPhotoDragResponder = useCallback((index: number) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      if (photoDragTimerRef.current) clearTimeout(photoDragTimerRef.current);
      photoDragOffset.setValue({ x: 0, y: 0 });
      measurePhotoGrid();
      photoDragRef.current = { index, active: false };
      photoDragTimerRef.current = setTimeout(() => {
        photoDragRef.current = { index, active: true };
        suppressPhotoPressRef.current = true;
        setDraggingPhotoIndex(index);
        setPhotoDropTarget(index);
      }, 180);
    },
    onPanResponderMove: (_, gestureState) => {
      if (!photoDragRef.current?.active) return;
      photoDragOffset.setValue({ x: gestureState.dx, y: gestureState.dy });
      const over = photoIndexFromPagePoint(gestureState.moveX, gestureState.moveY);
      setPhotoDropTarget(over);
    },
    onPanResponderRelease: (_, gestureState) => {
      if (photoDragTimerRef.current) {
        clearTimeout(photoDragTimerRef.current);
        photoDragTimerRef.current = null;
      }
      const from = photoDragRef.current?.index ?? index;
      const wasDragging = Boolean(photoDragRef.current?.active);
      const over = dragOverPhotoIndexRef.current ?? photoIndexFromPagePoint(gestureState.moveX, gestureState.moveY);
      photoDragRef.current = null;
      photoDragOffset.setValue({ x: 0, y: 0 });
      setDraggingPhotoIndex(null);
      setPhotoDropTarget(null);
      setTimeout(() => { suppressPhotoPressRef.current = false; }, 120);
      if (wasDragging) {
        if (over != null && over !== from) void handleReorderPhoto(from, over);
        return;
      }
      if (Math.abs(gestureState.dx) < 8 && Math.abs(gestureState.dy) < 8) {
        openPhotoAction(index);
      }
    },
    onPanResponderTerminate: () => {
      if (photoDragTimerRef.current) {
        clearTimeout(photoDragTimerRef.current);
        photoDragTimerRef.current = null;
      }
      photoDragRef.current = null;
      photoDragOffset.setValue({ x: 0, y: 0 });
      setDraggingPhotoIndex(null);
      setPhotoDropTarget(null);
      setTimeout(() => { suppressPhotoPressRef.current = false; }, 120);
    },
  }), [handleReorderPhoto, measurePhotoGrid, openPhotoAction, photoDragOffset, photoIndexFromPagePoint, setPhotoDropTarget]);

  const handleRemovePhoto = async (index: number) => {
    if (!user) return;

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
  };

  const closePhotoAction = () => setPhotoActionIndex(null);

  const runPhotoAction = async (action: 'add' | 'replace' | 'remove') => {
    const index = photoActionIndex;
    closePhotoAction();
    if (index == null) return;
    if (action === 'add') {
      await handleAddPhoto();
      return;
    }
    if (action === 'replace') {
      await handleReplacePhoto(index);
      return;
    }
    await handleRemovePhoto(index);
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

  /** Settings is a RN Modal; opening the paywall (another Modal) on top freezes iOS — close settings first (same pattern as blocked users). */
  const openUpgradeFromSettings = useCallback(() => {
    if (showRoomPearPlus) return;
    setSettingsOpen(false);
    setTimeout(() => {
      void presentPaywall();
    }, 320);
  }, [showRoomPearPlus, presentPaywall]);

  const openCustomerCenterFromSettings = useCallback(() => {
    setSettingsOpen(false);
    setTimeout(() => {
      void presentCustomerCenter();
    }, 320);
  }, [presentCustomerCenter]);

  const completionPct = useMemo(() => {
    let score = 0;
    if (imageUrls.length > 0) score += 20;
    if (profile?.bio?.trim()) score += 15;
    if (profile?.occupation?.trim()) score += 10;
    score += Math.round((Math.min(profileInterests.length, 5) / 5) * 20);
    const validPrompts = Array.isArray(profile?.prompts) ? profile.prompts.filter((p: any) => p?.question && p?.answer) : [];
    score += Math.round((Math.min(validPrompts.length, 3) / 3) * 20);
    if (prefs?.city || prefs?.state) score += 10;
    if (prefs?.min_budget || prefs?.max_budget) score += 5;
    return score;
  }, [imageUrls, profile, prefs, profileInterests.length]);

  const completionHint = useMemo(() => {
    const validPrompts = Array.isArray(profile?.prompts) ? profile.prompts.filter((p: any) => p?.question && p?.answer) : [];
    const interestNeed = Math.max(0, 5 - profileInterests.length);
    const missingInterestPts = 20 - Math.round((Math.min(profileInterests.length, 5) / 5) * 20);
    const missingPromptPts = 20 - Math.round((Math.min(validPrompts.length, 3) / 3) * 20);
    const need = 3 - Math.min(validPrompts.length, 3);

    const gaps: { pts: number; msg: string }[] = [];
    if (imageUrls.length === 0)          gaps.push({ pts: 20, msg: 'add a photo — no one can see you without one' });
    if (missingInterestPts > 0)          gaps.push({ pts: missingInterestPts, msg: `add ${interestNeed} more interest${interestNeed > 1 ? 's' : ''} to find better matches` });
    if (missingPromptPts > 0)            gaps.push({ pts: missingPromptPts, msg: `add ${need} more prompt${need > 1 ? 's' : ''} to boost your score` });
    if (!profile?.bio?.trim())           gaps.push({ pts: 15, msg: 'add a bio so future roommates can get to know you' });
    if (!prefs?.city && !prefs?.state)   gaps.push({ pts: 10, msg: 'add your city to appear in local searches' });
    if (!profile?.occupation?.trim())    gaps.push({ pts: 10, msg: 'add your occupation to boost your score' });
    if (!prefs?.min_budget && !prefs?.max_budget) gaps.push({ pts: 5, msg: 'add a budget range to improve your matches' });

    gaps.sort((a, b) => b.pts - a.pts);
    return gaps[0]?.msg ?? '';
  }, [imageUrls, profile, prefs]);

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
    listingRent: listing?.rent ?? null,
    minBudget: prefs?.min_budget ?? null,
    maxBudget: prefs?.max_budget ?? null,
    compatibilityScore: 0,
    matchReasons: [],
  }), [user?.id, displayName, displayAge, profile, prefs, profileHobbies, profilePromptsForOverview, imageUrls, listingPhotoUrls, listingSearchLocationLine, listing]);


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
            <TouchableOpacity style={styles.headerNameRow} onPress={openEditName} activeOpacity={0.7} disabled={nameEditing}>
              {nameEditing ? (
                <TextInput
                  ref={nameInputRef}
                  style={styles.headerTitleInput}
                  value={editName}
                  onChangeText={setEditName}
                  onBlur={handleSaveName}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                  maxLength={40}
                />
              ) : (
                <>
                  <Text style={styles.headerTitle}>{displayName || 'Your name'}</Text>
                  <Ionicons name="pencil" size={16} color="#6A8070" style={{ marginTop: 6 }} />
                </>
              )}
            </TouchableOpacity>
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
                  <View style={styles.strengthTitleRow}>
                    <View style={styles.strengthIconBadge}>
                      <Ionicons name="sparkles-outline" size={15} color="#2D6A4F" />
                    </View>
                    <View>
                      <Text style={styles.strengthLabel}>ROOMPEAR READY <Text style={styles.strengthScoreInline}>{completionPct}%</Text></Text>
                      <Text style={styles.strengthSub}>More complete profiles get better matches.</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.strengthBarTrack}>
                  <View style={[styles.strengthBarFill, { width: `${completionPct}%` as any }]} />
                </View>
                {completionHint ? (
                  <View style={styles.strengthHintRow}>
                    <Ionicons name="arrow-forward-circle-outline" size={14} color="#6A8070" />
                    <Text style={styles.strengthHint}>{completionHint}</Text>
                  </View>
                ) : (
                  <View style={styles.strengthHintRow}>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#2D6A4F" />
                    <Text style={styles.strengthHint}>your profile is ready to show off</Text>
                  </View>
                )}
              </View>


              {/* Bottom action row */}
              <View style={styles.actionBtnRow}>
                <TouchableOpacity style={styles.previewBtnSmall} activeOpacity={0.9} onPress={() => setPreviewOpen(true)}>
                  <Ionicons name="eye-outline" size={18} color="white" />
                  <Text style={styles.previewBtnSmallText}>Preview</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editProfileBtn} activeOpacity={0.88} onPress={() => openConsolidatedEditor()}>
                  <Ionicons name="person-outline" size={18} color="#111111" />
                </TouchableOpacity>
              </View>

              {/* Premium upsell card */}
              {!showRoomPearPlus && (
                <TouchableOpacity style={styles.premiumCard} onPress={() => void openUpgradeIfNeeded()} activeOpacity={0.88}>
                  <View style={styles.premiumCardTop}>
                    <View style={styles.premiumEyebrowRow}>
                      <Ionicons name="star" size={11} color="#C84200" />
                      <Text style={styles.premiumEyebrow}>ROOMPEAR+</Text>
                    </View>
                    <Text style={styles.premiumTitle}>Find your person faster</Text>
                  </View>
                  <View style={styles.premiumFeatures}>
                    {[
                      { icon: 'eye-outline',            label: 'See everyone who liked you' },
                      { icon: 'infinite-outline',       label: 'Unlimited swipes daily' },
                      { icon: 'star-outline',           label: '5 Top Picks per day' },
                      { icon: 'flash-outline',          label: 'Priority in discover' },
                    { icon: 'people-outline',          label: 'More roommates who actually fit what you\'re looking for' },
                    ].map(({ icon, label }) => (
                      <View key={label} style={styles.premiumFeatureRow}>
                        <Ionicons name={icon as any} size={15} color="#8A6A1A" />
                        <Text style={styles.premiumFeatureText}>{label}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.premiumCta}>
                    <Text style={styles.premiumCtaText}>Upgrade</Text>
                    <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              )}

              <Text style={styles.footerText}>v1.0</Text>

            </View>
          </ScrollView>
        </View>
      )}

      {/* Profile editor modal */}
      <DraggableSheet
        visible={profileEditorSection !== null}
        onClose={() => setProfileEditorSection(null)}
        fullScreen
        presentationStyle="fullScreen"
        topInset={insets.top + 12}
      >
        <LinearGradient
          colors={['#F7E8DC', '#FAF0E8', '#FCF5EF', '#FEFAF7', '#FFFFFF']}
          locations={[0, 0.25, 0.55, 0.80, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.editorGradientRoot}
        >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          style={styles.editorSheetInner}
        >
            <View style={[styles.editorHeaderRow, profileEditorSection === 'photos' && styles.photoEditorHeaderRow]}>
              {profileEditorSection === 'photos' ? (
                <View style={{ width: 38 }} />
              ) : null}
              <Text style={styles.editorTitle}>
                {profileEditorSection === 'photos' ? 'edit photos'
                  : profileEditorSection === 'basics' ? 'About Me'
                  : profileEditorSection === 'interests' ? 'Interests'
                  : profileEditorSection === 'dealbreakers' ? 'Dealbreakers'
                  : 'Prompts'}
              </Text>
              {profileEditorSection === 'photos' ? (
                <TouchableOpacity
                  onPress={() => setProfileEditorSection(null)}
                  style={styles.editorClosePill}
                  hitSlop={10}
                  activeOpacity={0.75}
                >
                  <Ionicons name="chevron-down" size={24} color="#111111" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setProfileEditorSection(null)}>
                  <Ionicons name="close" size={24} color="#3A3A3A" />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              style={styles.editorScroll}
              contentContainerStyle={[
                styles.editorScrollContent,
                profileEditorSection === 'photos' && { paddingBottom: 48 + Math.max(insets.bottom, 16) },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              bounces={profileEditorSection !== 'photos'}
              alwaysBounceVertical={profileEditorSection !== 'photos'}
              overScrollMode={profileEditorSection === 'photos' ? 'never' : 'auto'}
              scrollEnabled={profileEditorSection !== 'photos'}
              {...(Platform.OS === 'ios' ? { automaticallyAdjustKeyboardInsets: true } : {})}
            >

              {/* Photos */}
              {profileEditorSection === 'photos' && (
                <>
                  <Text style={styles.photoEditSectionLabel}>PHOTOS</Text>
                  <Text style={styles.photoEditSub}>Tap to add or edit. Hold and drag to reorder.</Text>
                  {savingPhotos && <ActivityIndicator style={{ marginVertical: 12 }} color="#111111" />}
                  <View
                    ref={photoGridRef}
                    style={styles.photoEditGrid}
                    onLayout={measurePhotoGrid}
                  >
                    {Array.from({ length: MAX_PROFILE_PHOTOS }).map((_, idx) => {
                      const url = imageUrls[idx];
                      const hasPhoto = Boolean(url);
                      const dragResponder = hasPhoto ? createPhotoDragResponder(idx) : null;
                      const isDragging = draggingPhotoIndex === idx;
                      const slotStyle = [
                        styles.photoEditSlot,
                        !hasPhoto && styles.photoEditSlotEmpty,
                        isDragging && styles.photoEditSlotDragging,
                      ];
                      const slotContent = hasPhoto ? (
                        <>
                          <Image source={{ uri: url }} style={styles.photoEditThumbImg} />
                          <View style={styles.photoEditRemoveBtn}>
                            <Ionicons name="create-outline" size={13} color="#fff" />
                          </View>
                          {idx === 0 && (
                            <View style={styles.photoEditMainBadge}>
                              <Text style={styles.photoEditMainBadgeText}>Main</Text>
                            </View>
                          )}
                        </>
                      ) : (
                        <>
                          <Ionicons name="camera-outline" size={28} color="#111111" />
                          <Text style={styles.photoEditAddText}>Add</Text>
                        </>
                      );

                      return hasPhoto && dragResponder ? (
                        <Animated.View
                          key={`photo-slot-${idx}`}
                          style={[
                            slotStyle,
                            isDragging && {
                              zIndex: 20,
                              elevation: 20,
                              transform: [
                                ...photoDragOffset.getTranslateTransform(),
                                { scale: 1.03 },
                              ],
                            },
                          ]}
                          {...dragResponder.panHandlers}
                        >
                          {slotContent}
                        </Animated.View>
                      ) : (
                        <TouchableOpacity
                          key={`photo-slot-${idx}`}
                          style={slotStyle}
                          onPress={() => openPhotoAction(idx)}
                          disabled={savingPhotos}
                          activeOpacity={0.85}
                        >
                          {slotContent}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Basics */}
              {profileEditorSection === 'basics' && (
                <>
                  <Text style={styles.basicsLabel}>Bio</Text>
                  <TextInput style={styles.basicsTextInput} value={editBio} onChangeText={setEditBio} placeholder="Tell future roommates about yourself…" placeholderTextColor="#AAAAAA" multiline maxLength={300} />
                  <Text style={styles.basicsLabel}>Occupation <Text style={styles.basicsOptional}>(optional)</Text></Text>
                  <TextInput style={[styles.basicsTextInput, { minHeight: 44 }]} value={editOccupation} onChangeText={setEditOccupation} placeholder="e.g. Student, Software Engineer…" placeholderTextColor="#AAAAAA" maxLength={60} />
                  <Text style={styles.basicsLabel}>Gender</Text>
                  <View style={styles.chipsWrap}>
                    {['Man', 'Woman', 'Non-binary', 'Other', 'Prefer not to say'].map((g) => (
                      <TouchableOpacity key={g} style={[styles.chip, editGender === g && styles.chipOn]} onPress={() => setEditGender(g)}>
                        <Text style={[styles.chipText, editGender === g && styles.chipTextOn]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.basicsLabel}>Ethnicity <Text style={styles.basicsOptional}>(optional)</Text></Text>
                  <View style={styles.chipsWrap}>
                    {['Asian', 'Black / African American', 'Hispanic / Latino', 'Middle Eastern', 'Native American', 'Pacific Islander', 'White / Caucasian', 'Multiracial'].map((e) => (
                      <TouchableOpacity key={e} style={[styles.chip, editEthnicity === e && styles.chipOn]} onPress={() => setEditEthnicity(editEthnicity === e ? '' : e)}>
                        <Text style={[styles.chipText, editEthnicity === e && styles.chipTextOn]}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.basicsLabel}>Schedule</Text>
                  <View style={styles.chipsWrap}>
                    {[{ val: 'Student', label: 'Student' }, { val: '9-to-5', label: '9 to 5' }, { val: 'Remote', label: 'Remote / WFH' }, { val: 'Night Shift', label: 'Night Shift' }, { val: 'Flexible', label: 'Flexible' }].map(({ val, label }) => (
                      <TouchableOpacity key={val} style={[styles.chip, editWorkSchedule === val && styles.chipOn]} onPress={() => setEditWorkSchedule(val)}>
                        <Text style={[styles.chipText, editWorkSchedule === val && styles.chipTextOn]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.basicsLabel}>Social Vibe</Text>
                  <View style={styles.chipsWrap}>
                    {['Social Butterfly', 'Balanced', 'Homebody'].map((v) => (
                      <TouchableOpacity key={v} style={[styles.chip, editSocialPref === v && styles.chipOn]} onPress={() => setEditSocialPref(v)}>
                        <Text style={[styles.chipText, editSocialPref === v && styles.chipTextOn]}>{v}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.basicsLabel}>Cleanliness <Text style={styles.basicsOptional}>(1 = relaxed · 5 = spotless)</Text></Text>
                  <View style={styles.chipsWrap}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity key={n} style={[styles.chip, editCleanliness === n && styles.chipOn]} onPress={() => setEditCleanliness(n)}>
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
                          <TouchableOpacity style={styles.promptPickerCancel} onPress={() => setPromptPickerIndex(null)}>
                            <Text style={styles.promptPickerCancelText}>Cancel</Text>
                            <Ionicons name="chevron-forward" size={14} color="#888" />
                          </TouchableOpacity>
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
          {photoActionIndex !== null && profileEditorSection === 'photos' && (
            <Pressable style={styles.photoActionOverlay} onPress={closePhotoAction}>
              <Pressable
                style={[styles.photoActionSheet, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.photoActionHandle} />
                <View style={styles.photoActionHeader}>
                  <View style={styles.photoActionIconBadge}>
                    <Ionicons
                      name={imageUrls[photoActionIndex] ? 'image-outline' : 'camera-outline'}
                      size={22}
                      color="#2D6A4F"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.photoActionTitle}>
                      {imageUrls[photoActionIndex] ? 'Edit photo' : 'Add photo'}
                    </Text>
                    <Text style={styles.photoActionSub}>
                      {photoActionIndex === 0 && imageUrls[photoActionIndex]
                        ? 'This is your main profile photo'
                        : 'Photos update automatically'}
                    </Text>
                  </View>
                </View>

                {imageUrls[photoActionIndex] ? (
                  <>
                    <TouchableOpacity
                      style={styles.photoActionPrimary}
                      onPress={() => void runPhotoAction('replace')}
                      activeOpacity={0.86}
                    >
                      <Ionicons name="swap-horizontal-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.photoActionPrimaryText}>Replace photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.photoActionDanger}
                      onPress={() => void runPhotoAction('remove')}
                      activeOpacity={0.84}
                    >
                      <Ionicons name="trash-outline" size={20} color="#D4183D" />
                      <Text style={styles.photoActionDangerText}>Remove photo</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.photoActionPrimary}
                    onPress={() => void runPhotoAction('add')}
                    activeOpacity={0.86}
                  >
                    <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.photoActionPrimaryText}>Choose photo</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.photoActionCancel} onPress={closePhotoAction} activeOpacity={0.8}>
                  <Text style={styles.photoActionCancelText}>Cancel</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          )}
        </LinearGradient>
      </DraggableSheet>

      {/* Consolidated edit modal */}
      <DraggableSheet visible={consolidatedEditOpen} onClose={() => setConsolidatedEditOpen(false)} fullScreen>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.editorSheetInner}
        >
            <LinearGradient
              colors={['#E5F5E4', '#F7FBF0', '#FFFFFF']}
              locations={[0, 0.62, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.ceHero, { paddingTop: insets.top + 16 }]}
            >
              <View style={styles.ceHeroTopRow}>
                <View style={styles.ceHeroAvatar}>
                  {imageUrls[0] ? (
                    <Image source={{ uri: imageUrls[0] }} style={styles.ceHeroAvatarImg} />
                  ) : (
                    <Ionicons name="person-outline" size={28} color="#2D6A4F" />
                  )}
                </View>
                <View style={styles.ceHeroCopy}>
                  <Text style={styles.ceHeroEyebrow}>PROFILE DETAILS</Text>
                  <Text style={styles.ceHeroTitle}>Who You Are</Text>
                  <Text style={styles.ceHeroSub}>Make the first impression feel like you.</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setConsolidatedEditOpen(false)}
                  style={styles.ceHeroClose}
                  hitSlop={10}
                  activeOpacity={0.75}
                >
                  <Ionicons name="close" size={22} color="#27382D" />
                </TouchableOpacity>
              </View>
              <View style={styles.ceHeroStatsRow}>
                <View style={styles.ceHeroChip}>
                  <Ionicons name="sparkles-outline" size={13} color="#2D6A4F" />
                  <Text style={styles.ceHeroChipText}>{profileInterests.length} interests</Text>
                </View>
                <View style={styles.ceHeroChip}>
                  <Ionicons name="chatbubble-ellipses-outline" size={13} color="#2D6A4F" />
                  <Text style={styles.ceHeroChipText}>{profilePromptsForOverview.length} prompts</Text>
                </View>
                <View style={styles.ceHeroChip}>
                  <Ionicons name="checkmark-circle-outline" size={13} color="#2D6A4F" />
                  <Text style={styles.ceHeroChipText}>{completionPct}% ready</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Tab bar */}
            <View style={[styles.ceTabBar, styles.ceTabBarContent, { justifyContent: 'center' }]}>
              {(['basics', 'prompts', 'interests', 'dealbreakers'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.ceTab, consolidatedEditTab === tab && styles.ceTabActive]}
                  onPress={() => setConsolidatedEditTab(tab)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.ceTabText, consolidatedEditTab === tab && styles.ceTabTextActive]}>
                    {tab === 'basics' ? 'About' : tab === 'prompts' ? 'Prompts' : tab === 'interests' ? 'Interests' : 'Lifestyle'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={styles.editorScroll} contentContainerStyle={styles.editorScrollContent} keyboardShouldPersistTaps="handled" nestedScrollEnabled>

              {/* About tab */}
              {consolidatedEditTab === 'basics' && (
                <>
                  <Text style={[styles.basicsLabel, { marginTop: -2 }]}>Bio</Text>
                  <TextInput style={styles.basicsTextInput} value={editBio} onChangeText={setEditBio} onBlur={() => void autoSaveProfile({ bio: editBio.trim() || null })} placeholder="Tell future roommates about yourself…" placeholderTextColor="#AAAAAA" multiline maxLength={300} />
                  <Text style={styles.basicsLabel}>Occupation <Text style={styles.basicsOptional}>(optional)</Text></Text>
                  <TextInput style={[styles.basicsTextInput, { minHeight: 44 }]} value={editOccupation} onChangeText={setEditOccupation} onBlur={() => void autoSaveProfile({ occupation: editOccupation.trim() || null })} placeholder="e.g. Student, Software Engineer…" placeholderTextColor="#AAAAAA" maxLength={60} />
                  <Text style={styles.basicsLabel}>Gender</Text>
                  <View style={styles.chipsWrap}>
                    {['Man', 'Woman', 'Non-binary', 'Other', 'Prefer not to say'].map((g) => (
                      <TouchableOpacity key={g} style={[styles.chip, editGender === g && styles.chipOn]} onPress={() => { setEditGender(g); void autoSaveProfile({ gender: g }); }}>
                        <Text style={[styles.chipText, editGender === g && styles.chipTextOn]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.basicsLabel}>Ethnicity <Text style={styles.basicsOptional}>(optional)</Text></Text>
                  <View style={styles.chipsWrap}>
                    {['Asian', 'Black / African American', 'Hispanic / Latino', 'Middle Eastern', 'Native American', 'Pacific Islander', 'White / Caucasian', 'Multiracial'].map((e) => (
                      <TouchableOpacity key={e} style={[styles.chip, editEthnicity === e && styles.chipOn]} onPress={() => { const v = editEthnicity === e ? '' : e; setEditEthnicity(v); void autoSaveProfile({ ethnicity: v || null }); }}>
                        <Text style={[styles.chipText, editEthnicity === e && styles.chipTextOn]}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.basicsLabel}>Schedule</Text>
                  <View style={styles.chipsWrap}>
                    {[{ val: 'Student', label: 'Student' }, { val: '9-to-5', label: '9 to 5' }, { val: 'Remote', label: 'Remote / WFH' }, { val: 'Night Shift', label: 'Night Shift' }, { val: 'Flexible', label: 'Flexible' }].map(({ val, label }) => (
                      <TouchableOpacity key={val} style={[styles.chip, editWorkSchedule === val && styles.chipOn]} onPress={() => { setEditWorkSchedule(val); void autoSavePrefs({ work_schedule: val }); }}>
                        <Text style={[styles.chipText, editWorkSchedule === val && styles.chipTextOn]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.basicsLabel}>Social Vibe</Text>
                  <View style={styles.chipsWrap}>
                    {['Social Butterfly', 'Balanced', 'Homebody'].map((v) => (
                      <TouchableOpacity key={v} style={[styles.chip, editSocialPref === v && styles.chipOn]} onPress={() => { setEditSocialPref(v); const mapped = v === 'Social Butterfly' ? 'social' : v === 'Homebody' ? 'quiet' : 'balanced'; void autoSavePrefs({ social_preference: mapped as any }); }}>
                        <Text style={[styles.chipText, editSocialPref === v && styles.chipTextOn]}>{v}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.basicsLabel}>Cleanliness <Text style={styles.basicsOptional}>(1 = relaxed · 5 = spotless)</Text></Text>
                  <View style={styles.chipsWrap}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity key={n} style={[styles.chip, editCleanliness === n && styles.chipOn]} onPress={() => { setEditCleanliness(n); void autoSavePrefs({ cleanliness_level: n }); }}>
                        <Text style={[styles.chipText, editCleanliness === n && styles.chipTextOn]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Prompts tab */}
              {consolidatedEditTab === 'prompts' && (
                <>
                  <Text style={styles.prefSectionSub}>Pick up to 3 prompts and answer them.</Text>
                  {editPrompts.map((entry, idx) => (
                    <View key={idx} style={styles.promptBlock}>
                      {promptPickerIndex === idx ? (
                        <View style={styles.promptPickerList}>
                          <TouchableOpacity style={styles.promptPickerCancel} onPress={() => setPromptPickerIndex(null)}>
                            <Text style={styles.promptPickerCancelText}>Cancel</Text>
                            <Ionicons name="chevron-forward" size={14} color="#888" />
                          </TouchableOpacity>
                          {PROMPTS.filter((p) => !editPrompts.some((e, i) => i !== idx && e.question === p)).map((p) => (
                            <TouchableOpacity key={p} style={styles.promptPickerItem} onPress={() => { const updated = editPrompts.map((e, i) => (i === idx ? { ...e, question: p } : e)); setEditPrompts(updated); setPromptPickerIndex(null); void autoSavePrompts(updated); }}>
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
                      <TextInput style={styles.promptAnswerInput} value={entry.answer} onChangeText={(t) => setEditPrompts((prev) => prev.map((e, i) => (i === idx ? { ...e, answer: t } : e)))} onBlur={() => void autoSavePrompts(editPrompts)} placeholder="Your answer…" placeholderTextColor="#9AA" multiline maxLength={300} />
                      <TouchableOpacity onPress={() => { const updated = editPrompts.filter((_, i) => i !== idx); setEditPrompts(updated); void autoSavePrompts(updated); }}>
                        <Text style={styles.promptRemove}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {editPrompts.length < 3 && (
                    <TouchableOpacity style={styles.addPromptBtn} onPress={() => setEditPrompts((prev) => [...prev, { question: '', answer: '' }])}>
                      <Text style={styles.addPromptBtnText}>+ Add prompt</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* Interests tab */}
              {consolidatedEditTab === 'interests' && (
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
                        {isCatExpanded && (
                          <View style={styles.chipsWrap}>
                            {cat.options.map((opt) => {
                              const on = selected.includes(opt);
                              const disabled = !on && selected.length >= 5;
                              return (
                                <TouchableOpacity key={opt} style={[styles.chip, on && styles.chipOn, disabled && styles.chipDim]} disabled={disabled} onPress={() => { const cur = editInterests[cat.key] ?? []; const newCatVal = on ? cur.filter((x) => x !== opt) : [...cur, opt]; const newInterests = { ...editInterests, [cat.key]: newCatVal }; setEditInterests(newInterests); void autoSavePrefs({ interests: newInterests }); }}>
                                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              )}

              {/* Dealbreakers tab */}
              {consolidatedEditTab === 'dealbreakers' && (
                <>
                  <Text style={styles.prefSectionSub}>Be upfront — let roommates know what living with you is like</Text>
                  {DEALBREAKER_ITEMS.map((item) => {
                    const val = editDealbreakers[item.key] ?? 'none';
                    const cycleNext = () => {
                      const next = DB_CYCLE[(DB_CYCLE.indexOf(val) + 1) % DB_CYCLE.length];
                      const newDB = { ...editDealbreakers, [item.key]: next };
                      setEditDealbreakers(newDB);
                      void autoSavePrefs({ dealbreakers: newDB });
                    };
                    const stateColor = val === 'hard' ? '#C84040' : val === 'soft' ? '#D4780A' : '#2D6A4F';
                    const stateBg = val === 'hard' ? '#FEF2F2' : val === 'soft' ? '#FFF7ED' : '#EDF7F1';
                    const stateLabel = val === 'hard' ? 'Yes' : val === 'soft' ? 'Rarely' : 'Never';
                    const iconName = DB_ICON_MAP[item.key] ?? 'help-circle-outline';
                    return (
                      <TouchableOpacity key={item.key} style={[styles.dbCard, { borderLeftColor: stateColor }]} onPress={cycleNext} activeOpacity={0.72}>
                        <View style={[styles.dbIconWrap, { backgroundColor: stateBg }]}>
                          <Ionicons name={iconName as any} size={18} color={stateColor} />
                        </View>
                        <Text style={styles.dbCardLabel}>{item.label}</Text>
                        <View style={[styles.dbStateBadge, { backgroundColor: stateBg }]}>
                          <Text style={[styles.dbStateBadgeText, { color: stateColor }]}>{stateLabel}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

            </ScrollView>
        </KeyboardAvoidingView>
      </DraggableSheet>

      {/* Preview as roommate modal */}
      <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#F2F4F0' }}>
          <SwipeCard
            profile={previewProfile}
            scrollPaddingTop={insets.top + 64}
            style={{ flex: 1, width: '100%', borderRadius: 0, shadowOpacity: 0, elevation: 0 } as any}
          />
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
              <TouchableOpacity onPress={() => setPreviewOpen(false)} hitSlop={12} activeOpacity={0.75}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 }}>
                  <Ionicons name="chevron-down" size={22} color="#111111" />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SettingsModal
        visible={settingsOpen}
        profile={profile}
        user={user}
        referralDraft={referralDraft}
        referralBusy={referralBusy}
        setReferralDraft={setReferralDraft}
        onClose={() => setSettingsOpen(false)}
        isPaused={isPaused}
        onTogglePause={handleTogglePause}
        onCopyReferralCode={handleCopyReferralCode}
        onApplyReferralCode={handleApplyReferralCode}
        isPremium={showRoomPearPlus}
        onUpgradeToPlus={openUpgradeFromSettings}
        onManageSubscription={openCustomerCenterFromSettings}
        onDeleteAccount={handleDeleteAccount}
        onOpenBlockedUsers={() => { setSettingsOpen(false); setTimeout(() => setBlockedUsersOpen(true), 280); }}
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

      <ListingModal
        visible={listingOpen}
        listingExists={Boolean(listing)}
        editListingPhotos={editListingPhotos}
        maxListingPhotos={MAX_LISTING_PHOTOS}
        editRent={editRent}
        editRoomType={editRoomType}
        setEditRent={setEditRent}
        setEditRoomType={setEditRoomType}
        setEditListingPhotos={setEditListingPhotos}
        onClose={() => setListingOpen(false)}
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
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 32, color: '#111111', letterSpacing: -0.5, flexShrink: 1 },
  headerTitleInput: { fontFamily: fonts.extraBold, fontSize: 32, color: '#111111', letterSpacing: -0.5, flexShrink: 1, padding: 0, minWidth: 120 },
  gearBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },

  profileScroll: { flex: 1 },
  profileScrollContent: { paddingTop: 0 },

  // Photo circles
  photoCirclesRow: { flexDirection: 'row', justifyContent: 'center', gap: 32, paddingVertical: 16 },
  photoCircleWrap: { alignItems: 'center', gap: 6 },
  photoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#C8D8CA', borderWidth: 2.5, borderColor: '#111111', shadowColor: '#2D6A4F', shadowOpacity: 0.16, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4 },
  photoCircleEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#C0D8C4', borderStyle: 'dashed' },
  photoCircleEditBadge: { position: 'absolute', bottom: 22, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  photoCircleLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: '#6A8070' },

  // Content
  contentPad: { paddingHorizontal: 16, paddingTop: 14 },
  pausedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFF8E1', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#F0C040' },
  pausedBannerText: { flex: 1, fontSize: 13, color: '#7A5C00', fontWeight: '500' },

  // Strength
  strengthSection: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 18, padding: 15, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(45,106,79,0.12)', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8 },
  strengthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 },
  strengthTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  strengthIconBadge: { width: 34, height: 34, borderRadius: 13, backgroundColor: 'rgba(45,106,79,0.09)', alignItems: 'center', justifyContent: 'center' },
  strengthLabel: { fontFamily: fonts.bold, fontSize: 11, color: '#111111', letterSpacing: 0.7 },
  strengthSub: { fontFamily: fonts.regular, fontSize: 12, color: '#6A8070', marginTop: 2 },
  strengthScoreInline: { fontFamily: fonts.bold, fontSize: 11, color: '#888888' },
  strengthBarTrack: { height: 6, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' },
  strengthBarFill: { height: '100%', backgroundColor: '#111111', borderRadius: 3 },
  strengthHintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  strengthHint: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: '#6A8070' },


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

  // Bottom action row
  actionBtnRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },

  // Premium upsell card
  premiumCard: { backgroundColor: '#FBF6E8', borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(200,66,0,0.2)', shadowColor: '#C84200', shadowOpacity: 0.07, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8 },
  premiumCardTop: { marginBottom: 14 },
  premiumEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  premiumEyebrow: { fontFamily: fonts.bold, fontSize: 11, color: '#C84200', letterSpacing: 0.9 },
  premiumTitle: { fontFamily: fonts.extraBold, fontSize: 19, color: '#111111', letterSpacing: -0.4 },
  premiumFeatures: { gap: 9, marginBottom: 16 },
  premiumFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  premiumFeatureText: { fontFamily: fonts.regular, fontSize: 14, color: '#3A3020' },
  premiumCta: { backgroundColor: '#111111', borderRadius: 13, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  premiumCtaText: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: -0.1 },
  previewBtnSmall: { flex: 7, backgroundColor: '#111111', borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewBtnSmallText: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: -0.2 },
  editProfileBtn: { flex: 3, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.1)' },
  editProfileBtnText: { fontFamily: fonts.bold, fontSize: 15, color: '#111111', letterSpacing: -0.2 },
  // Consolidated editor tabs
  ceTabBar: { maxHeight: 48, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 3, zIndex: 1 },
  ceTabBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 6, flexDirection: 'row', alignItems: 'center' },
  ceTab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F0F0F0' },
  ceTabActive: { backgroundColor: '#111111' },
  ceTabText: { fontFamily: fonts.semiBold, fontSize: 13, color: '#888' },
  ceTabTextActive: { color: '#FFFFFF' },
  ceHero: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(45,106,79,0.10)' },
  ceHeroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ceHeroAvatar: { width: 58, height: 58, borderRadius: 20, backgroundColor: 'rgba(45,106,79,0.10)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(45,106,79,0.12)' },
  ceHeroAvatarImg: { width: '100%', height: '100%' },
  ceHeroCopy: { flex: 1 },
  ceHeroEyebrow: { fontFamily: fonts.bold, fontSize: 10, color: '#6A8B70', letterSpacing: 1.1, marginBottom: 2 },
  ceHeroTitle: { fontFamily: fonts.extraBold, fontSize: 26, color: '#111111', letterSpacing: -0.5 },
  ceHeroSub: { fontFamily: fonts.regular, fontSize: 13, color: '#6F8574', marginTop: 2 },
  ceHeroClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  ceHeroStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 },
  ceHeroChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(45,106,79,0.13)' },
  ceHeroChipText: { fontFamily: fonts.semiBold, fontSize: 12, color: '#2D6A4F' },
  sectionCardCount: { fontFamily: fonts.regular, fontSize: 12, color: '#9AAAA0' },
  // Legacy preview button (kept for style reference)
  previewBtn: { backgroundColor: '#111111', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 22, gap: 12 },
  previewBtnTitle: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF', letterSpacing: -0.2 },
  previewBtnSub: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Account menu (kept for SettingsModal compatibility)
  accountSectionLabel: { fontFamily: fonts.bold, fontSize: 11, color: '#7A9080', letterSpacing: 0.7, marginBottom: 8 },
  accountMenu: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 14, overflow: 'hidden', marginBottom: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.07)' },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 13 },
  menuIconBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EAF4EE', alignItems: 'center', justifyContent: 'center' },
  menuIconBadgeDestructive: { backgroundColor: '#FEF0F0' },
  menuLabel: { fontFamily: fonts.semiBold, fontSize: 15, color: '#111111' },
  menuLabelDestructive: { color: '#D4183D' },
  menuSub: { fontFamily: fonts.regular, fontSize: 12, color: '#8AA89A', marginTop: 1 },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.07)', marginLeft: 49 },
  footerText: { fontFamily: fonts.regular, fontSize: 12, color: '#9AAAA0', textAlign: 'center', marginBottom: 8 },

  // Profile section cards
  sectionCard: { backgroundColor: 'rgba(255,255,255,0.90)', borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.07)', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8 },
  sectionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionCardLabel: { fontFamily: fonts.bold, fontSize: 11, color: '#4A6A50', letterSpacing: 0.7 },
  sectionEditPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(45,106,79,0.09)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  sectionEditPillText: { fontFamily: fonts.semiBold, fontSize: 12, color: '#2D6A4F' },
  sectionEmptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionEmptyText: { fontFamily: fonts.regular, fontSize: 14, color: '#9AAAA0' },
  sectionOccupationLine: { fontFamily: fonts.regular, fontSize: 14, color: '#6A8070', marginTop: 6 },
  sectionValueText: { fontFamily: fonts.regular, fontSize: 14, color: '#555' },
  photoStripThumb: { width: 62, height: 82, borderRadius: 10, backgroundColor: '#C8D8CA' },
  photoStripAdd: { width: 62, height: 82, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(106,128,112,0.3)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  promptPreviewCard: { backgroundColor: 'rgba(45,106,79,0.05)', borderRadius: 12, padding: 13, borderLeftWidth: 3, borderLeftColor: 'rgba(45,106,79,0.25)' },
  promptPreviewQ: { fontFamily: fonts.bold, fontSize: 10, color: '#7A9A80', letterSpacing: 0.5, marginBottom: 5, textTransform: 'uppercase' },
  promptPreviewA: { fontFamily: fonts.semiBold, fontSize: 14, color: '#111111', lineHeight: 20 },
  interestChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  interestDisplayChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F0F7F0', borderWidth: 1, borderColor: '#C4DEC4' },
  interestDisplayChipText: { fontFamily: fonts.semiBold, fontSize: 12, color: '#2D6A4F' },

  // Editor modal
  editorGradientRoot: { flex: 1 },
  editorSheetInner: { flex: 1 },
  editorHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  editorClosePill: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  editorTitle: { fontFamily: fonts.extraBold, fontSize: 20, color: '#111111', letterSpacing: -0.4 },
  editorScroll: { flex: 1 },
  editorScrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  // Photo editing
  photoEditorHeaderRow: { paddingTop: 18, paddingBottom: 14 },
  photoEditHeading: { fontFamily: fonts.extraBold, fontSize: 20, color: '#111111', letterSpacing: -0.4, marginBottom: 4 },
  photoEditSectionLabel: { fontFamily: fonts.bold, fontSize: 11, color: '#111111', letterSpacing: 0.8, marginBottom: 6, marginTop: 22 },
  photoEditSub: { fontFamily: fonts.regular, fontSize: 13, color: '#444444', marginBottom: 12, marginTop: -2 },
  photoEditGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoEditSlot: { position: 'relative', width: '31.3%', aspectRatio: 0.78, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#2D6A4F', shadowOpacity: 0.10, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 3 },
  photoEditSlotDragging: { opacity: 0.95, shadowColor: '#2D6A4F', shadowOpacity: 0.24, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 8 },
  photoEditSlotEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(180,120,90,0.30)', backgroundColor: 'rgba(255,255,255,0.72)', gap: 4 },
  photoEditThumbImg: { width: '100%', height: '100%', backgroundColor: '#C8D8CA', borderRadius: 14 },
  photoEditRemoveBtn: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  photoEditMainBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  photoEditMainBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: '#fff', letterSpacing: 0.3 },
  photoEditAddText: { fontFamily: fonts.semiBold, fontSize: 12, color: '#111111' },

  // Photo action sheet
  photoActionOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.34)', paddingHorizontal: 12, zIndex: 20 },
  photoActionSheet: { backgroundColor: '#F7FAF1', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.65)', shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: -8 }, shadowRadius: 22, elevation: 22 },
  photoActionHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 999, backgroundColor: 'rgba(45,106,79,0.18)', marginBottom: 16 },
  photoActionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  photoActionIconBadge: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(45,106,79,0.10)', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(45,106,79,0.12)' },
  photoActionTitle: { fontFamily: fonts.extraBold, fontSize: 20, color: '#111111', letterSpacing: -0.4 },
  photoActionSub: { fontFamily: fonts.regular, fontSize: 13, color: '#7A9080', marginTop: 2 },
  photoActionPrimary: { minHeight: 56, borderRadius: 17, backgroundColor: '#111111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 10 },
  photoActionPrimaryText: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF', letterSpacing: -0.1 },
  photoActionDanger: { minHeight: 54, borderRadius: 17, backgroundColor: 'rgba(212,24,61,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(212,24,61,0.18)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 10 },
  photoActionDangerText: { fontFamily: fonts.bold, fontSize: 16, color: '#D4183D', letterSpacing: -0.1 },
  photoActionCancel: { minHeight: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.74)', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.07)' },
  photoActionCancelText: { fontFamily: fonts.semiBold, fontSize: 15, color: '#5E6F62' },

  // Edit chips
  prefSectionSub: { fontSize: 13, color: '#888', marginBottom: 14 },
  catBlock: { marginBottom: 8, backgroundColor: '#F7F7F7', borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  catLabel: { fontFamily: fonts.semiBold, fontSize: 15, color: '#111111' },
  catChevron: { fontSize: 12, color: '#999' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.1)' },
  chipOn: { backgroundColor: '#111111', borderColor: '#111111' },
  chipDim: { opacity: 0.4 },
  chipText: { fontFamily: fonts.semiBold, fontSize: 13, color: '#444' },
  chipTextOn: { color: '#FFFFFF' },
  dbRow: { marginBottom: 16 },
  dbLabel: { fontFamily: fonts.semiBold, fontSize: 15, color: '#111111', marginBottom: 8 },
  dbBtns: { flexDirection: 'row', gap: 8 },
  dbBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#F7F7F7', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  dbBtnHard: { backgroundColor: '#E53E3E', borderColor: '#E53E3E' },
  dbBtnSoft: { backgroundColor: '#F6AD55', borderColor: '#F6AD55' },
  dbBtnNone: { backgroundColor: '#111111', borderColor: '#111111' },
  dbBtnText: { fontSize: 13, fontWeight: '500', color: '#555' },
  dbBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },
  dbCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10, borderLeftWidth: 3, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  dbIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  dbCardLabel: { flex: 1, fontSize: 14, fontFamily: fonts.medium, color: '#111111' },
  dbStateBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  dbStateBadgeText: { fontSize: 12, fontFamily: fonts.bold },
  promptBlock: { backgroundColor: '#F7F7F7', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  promptPickerList: { borderRadius: 10, overflow: 'hidden', marginBottom: 10, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  promptPickerCancel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)', backgroundColor: '#F7F7F7' },
  promptPickerCancelText: { fontSize: 13, color: '#888', fontFamily: fonts.medium },
  promptPickerItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.06)' },
  promptPickerText: { fontSize: 14, color: '#111111' },
  promptQuestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.07)' },
  promptQuestionText: { flex: 1, fontFamily: fonts.semiBold, fontSize: 14, color: '#111111', lineHeight: 20 },
  promptQuestionPlaceholder: { color: '#AAA', fontWeight: '400' },
  promptQuestionEdit: { fontSize: 16, color: '#999', marginLeft: 8 },
  promptAnswerInput: { fontSize: 15, color: '#111111', minHeight: 60, maxHeight: 120, paddingVertical: 4, paddingHorizontal: 0, textAlignVertical: 'top', marginBottom: 10 },
  promptRemove: { fontSize: 13, color: '#E85D4C', fontFamily: fonts.semiBold, alignSelf: 'flex-end' },
  addPromptBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.1)', borderStyle: 'dashed' },
  addPromptBtnText: { fontFamily: fonts.semiBold, fontSize: 15, color: '#111111' },
  accordionSaveBtn: { marginTop: 16, backgroundColor: '#111111', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  accordionSaveBtnText: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' },
  basicsLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: '#888', marginTop: 16, marginBottom: 8 },
  basicsOptional: { fontSize: 12, fontWeight: '400', color: '#AAA' },
  basicsTextInput: { backgroundColor: '#F7F7F7', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(45,106,79,0.12)', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111111', minHeight: 80, textAlignVertical: 'top', shadowColor: '#2D6A4F', shadowOpacity: 0.09, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 2 },

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
  signOutButton: { marginTop: 16, backgroundColor: '#111111', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  signOutButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
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
