/**
 * OnboardingScreen — unified 10-step full-screen onboarding flow.
 *
 * Steps:
 *  0  About You       (name, age, gender, ethnicity → profiles)
 *  1  Location        (city, state, zip → preferences)
 *  2  Budget          (min/max → preferences)
 *  3  Room + Move-in  (room_type, move_in_date → preferences)
 *  4  Lifestyle       (cleanliness, schedule, social, pets, smoking → preferences)
 *  5  Dealbreakers    (hard/soft/none per item → preferences.dealbreakers)
 *  6  Interests       (category chips → preferences.interests)
 *  7  Prompts         (pick 2–3, answer them → profiles.prompts)
 *  8  Photos          (upload photos → profiles.profile_photo_url)
 *  9  Listing         (optional → listings + profiles.has_listing)
 */

import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { savePreferences } from '../lib/preferences';
import { uploadStagedPhotosAndMerge } from '../lib/profilePhotos';
import { uploadProfileImage } from '../lib/storage';
import PublicProfileCard from '../components/PublicProfileCard';
import type { SearchAreaValue } from '../lib/searchAreaTypes';

const SearchAreaMapPicker = lazy(() => import('../components/SearchAreaMapPicker'));

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 10;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_THUMB = (SCREEN_WIDTH - 40 - 10) / 2; // 2-col grid, 20px padding each side, 10px gap

const GENDER_OPTIONS = ['Man', 'Woman', 'Non-binary', 'Other', 'Prefer not to say'];

const ETHNICITY_OPTIONS = [
  'Asian',
  'Black / African American',
  'Hispanic / Latino',
  'Middle Eastern',
  'Native American',
  'Pacific Islander',
  'White / Caucasian',
  'Multiracial',
  'Prefer not to say',
];

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
  {
    key: 'fitness',
    label: '🏃 Fitness',
    options: ['Running', 'Yoga', 'Gym', 'Hiking', 'Swimming', 'Cycling', 'Rock Climbing'],
  },
  {
    key: 'food',
    label: '🍕 Food & Drink',
    options: ['Cooking', 'Baking', 'Coffee', 'Wine & Cocktails', 'Foodie Adventures', 'Meal Prep'],
  },
  {
    key: 'arts',
    label: '🎨 Arts & Culture',
    options: ['Movies', 'Music', 'Reading', 'Photography', 'Art Galleries', 'Theater'],
  },
  {
    key: 'outdoors',
    label: '🌿 Outdoors',
    options: ['Camping', 'Travel', 'Beach', 'Gardening', 'Road Trips', 'Surfing'],
  },
  {
    key: 'tech',
    label: '🎮 Tech & Gaming',
    options: ['Gaming', 'Coding', 'Podcasts', 'Anime', 'Board Games', 'VR / AR'],
  },
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
  'My work-from-home setup is…',
  'Two truths and a lie about my living habits…',
  'I stay up until…',
  'I wake up at…',
  'My relationship with mess is…',
  'The soundtrack of my home is…',
  'My go-to snack situation…',
  'I unwind by…',
];

const STEP_TITLES = [
  'Tell us about you',
  'Where are you looking?',
  "What's your budget?",
  'What kind of room?',
  'Your lifestyle',
  'Any dealbreakers?',
  'Your interests',
  'In your own words',
  'Add your photos',
  'Do you have a place?',
];

const STEP_SUBTITLES = [
  'This helps us find compatible roommates.',
  "We'll show you people in your area.",
  "We'll match you within your range.",
  'Pick what works for you.',
  'Helps us find someone compatible.',
  'Hard = never · Soft = prefer not · None = fine.',
  'Select up to 5 per category.',
  'Pick 2–3 prompts to answer.',
  'Your first impression — make it count.',
  'Optional — skip if you are not listing a place.',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Human-readable label after picking a date (API still uses YMD). */
function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Chip component ───────────────────────────────────────────────────────────

function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PromptEntry = { question: string; answer: string };
type DealbreakerLevel = 'hard' | 'soft' | 'none';

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  // Core
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Step 0: About You
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [ethnicity, setEthnicity] = useState('');

  // Step 1: Location
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const useLegacyLocationUi = !Constants.expoConfig?.extra?.mapboxAccessToken || isExpoGo;
  const [city, setCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [searchArea, setSearchArea] = useState<SearchAreaValue | null>(null);

  // Step 2: Budget
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const maxBudgetInputRef = useRef<TextInput>(null);

  // Step 3: Room + Move-in
  const [roomType, setRoomType] = useState('');
  const [moveInDate, setMoveInDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Step 4: Lifestyle
  const [cleanliness, setCleanliness] = useState<number | null>(null);
  const [workSchedule, setWorkSchedule] = useState('');
  const [socialPref, setSocialPref] = useState('');
  const [petsAllowed, setPetsAllowed] = useState<boolean | null>(null);
  const [smokingAllowed, setSmokingAllowed] = useState<boolean | null>(null);

  // Step 5: Dealbreakers
  const [dealbreakers, setDealbreakers] = useState<Record<string, DealbreakerLevel>>(
    Object.fromEntries(DEALBREAKER_ITEMS.map((d) => [d.key, 'none' as DealbreakerLevel]))
  );

  // Step 6: Interests
  const [interests, setInterests] = useState<Record<string, string[]>>(
    Object.fromEntries(INTEREST_CATEGORIES.map((c) => [c.key, [] as string[]]))
  );
  const [expandedCategory, setExpandedCategory] = useState<string | null>('fitness');
  const [customInputs, setCustomInputs] = useState<Record<string, string>>(
    Object.fromEntries(INTEREST_CATEGORIES.map((c) => [c.key, '']))
  );

  // Step 7: Prompts
  const [promptAnswers, setPromptAnswers] = useState<PromptEntry[]>([]);

  // Step 8: Photos
  const [stagingUris, setStagingUris] = useState<string[]>([]);

  // Step 9: Listing
  const [hasListing, setHasListing] = useState(false);
  const [listingRent, setListingRent] = useState('');
  const [listingRoomType, setListingRoomType] = useState('');
  const [listingAddress, setListingAddress] = useState('');
  const [listingCity, setListingCity] = useState('');
  const [listingStateVal, setListingStateVal] = useState('');
  const [listingZip, setListingZip] = useState('');
  const [listingPhotos, setListingPhotos] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // ── Save helpers ───────────────────────────────────────────────────────────

  const ensureProfile = async (uid: string): Promise<boolean> => {
    const { data } = await supabase.from('profiles').select('id').eq('id', uid).single();
    if (data) return true;
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return false;
    const { error } = await supabase.from('profiles').insert({
      id: uid,
      email: user.email ?? '',
      name: user.user_metadata?.name ?? user.email ?? 'User',
      phone: user.user_metadata?.phone ?? '000-000-0000',
    });
    return !error;
  };

  const saveAboutYou = async (): Promise<boolean> => {
    if (!userId) return false;
    if (!(await ensureProfile(userId))) return false;
    const updates: Record<string, unknown> = {};
    if (name.trim()) updates.name = name.trim();
    if (age.trim()) updates.age = parseInt(age, 10);
    if (gender) updates.gender = gender;
    if (ethnicity) updates.ethnicity = ethnicity;
    if (Object.keys(updates).length === 0) return true;
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) console.warn('saveAboutYou', error.message);
    return !error;
  };

  const savePrompts = async (): Promise<void> => {
    if (!userId) return;
    const filtered = promptAnswers.filter((p) => p.answer.trim());
    if (filtered.length === 0) return;
    const { error } = await supabase
      .from('profiles')
      .update({ prompts: filtered })
      .eq('id', userId);
    if (error) console.warn('savePrompts', error.message);
  };

  const uploadPhotos = async (): Promise<boolean> => {
    if (!userId || stagingUris.length === 0) return true;
    const { ok, error } = await uploadStagedPhotosAndMerge(userId, stagingUris);
    if (!ok) {
      Alert.alert('Upload failed', error ?? 'Could not upload photos. Please try again.');
      return false;
    }
    return true;
  };

  const handleComplete = async () => {
    if (!userId) {
      Alert.alert('Error', 'Not signed in. Please restart the app.');
      setSaving(false);
      return;
    }
    try {
      // Save listing if opted in
      if (hasListing) {
        const photoPaths: string[] = [];
        for (const uri of listingPhotos) {
          const { path, error } = await uploadProfileImage(userId, uri);
          if (error || !path) {
            Alert.alert('Upload failed', 'Could not upload a listing photo. Please try again.');
            setSaving(false);
            return;
          }
          photoPaths.push(path);
        }
        const { error: listErr } = await supabase.from('listings').insert({
          user_id: userId,
          rent: listingRent ? parseFloat(listingRent) : null,
          room_type: listingRoomType || null,
          address: listingAddress || null,
          city: listingCity || null,
          state: listingStateVal || null,
          zip_code: listingZip || null,
          listing_photos: photoPaths,
        });
        if (listErr) console.warn('saveListing', listErr.message);
        await supabase.from('profiles').update({ has_listing: true }).eq('id', userId);
      }

      // Map social preference label to DB value
      const socialPrefMapped =
        socialPref === 'Social Butterfly' ? 'social'
        : socialPref === 'Homebody' ? 'quiet'
        : socialPref === 'Balanced' ? 'balanced'
        : undefined;

      const result = await savePreferences(userId, {
        city: (searchArea?.city || city.trim()) || undefined,
        state: (searchArea?.state || locationState.trim()) || undefined,
        zip_code: (searchArea?.zipCode || zipCode.trim()) || undefined,
        location: searchArea?.searchLabel || undefined,
        search_lat: searchArea?.latitude,
        search_lng: searchArea?.longitude,
        search_radius_miles: searchArea?.radiusMiles,
        search_label: searchArea?.searchLabel,
        min_budget: minBudget ? parseFloat(minBudget) : undefined,
        max_budget: maxBudget ? parseFloat(maxBudget) : undefined,
        room_type: (['private', 'shared', 'flexible', 'entire'] as const).includes(roomType as any)
          ? (roomType as 'private' | 'shared' | 'flexible' | 'entire')
          : undefined,
        move_in_date: moveInDate ? formatDateYMD(moveInDate) : undefined,
        pets_allowed: petsAllowed ?? undefined,
        smoking_allowed: smokingAllowed ?? undefined,
        cleanliness_level: cleanliness ?? undefined,
        work_schedule: workSchedule || undefined,
        social_preference: socialPrefMapped as any,
        interests: Object.values(interests).some((v) => v.length > 0) ? interests : undefined,
        dealbreakers,
      });

      if (!result.success) {
        Alert.alert('Error', result.error ?? 'Could not save preferences.');
        setSaving(false);
        return;
      }

      onComplete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Error', msg);
      setSaving(false);
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const advance = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));

  const handleBack = () => {
    if (saving) return;
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSkip = () => {
    if (saving) return;
    if (step === TOTAL_STEPS - 1) {
      setSaving(true);
      handleComplete();
    } else {
      advance();
    }
  };

  const handleNext = async () => {
    if (saving) return;

    if (step === TOTAL_STEPS - 1) {
      setSaving(true);
      await handleComplete();
      return;
    }

    setSaving(true);
    try {
      if (step === 0) {
        const ok = await saveAboutYou();
        if (!ok) {
          Alert.alert('Error', 'Could not save your info. Please try again.');
          return;
        }
      } else if (step === 7) {
        await savePrompts();
      } else if (step === 8) {
        const ok = await uploadPhotos();
        if (!ok) return;
      }
      advance();
    } finally {
      setSaving(false);
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  const canAdvance = (): boolean => {
    if (step === 0) return name.trim().length > 0;
    if (step === 2 && minBudget && maxBudget) {
      return parseFloat(minBudget) <= parseFloat(maxBudget);
    }
    return true;
  };

  // ── Photo pickers ──────────────────────────────────────────────────────────

  const pickProfilePhoto = async () => {
    if (stagingUris.length >= 4) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 5],
    });
    if (!result.canceled && result.assets[0]) {
      setStagingUris((prev) => [...prev, result.assets[0].uri].slice(0, 4));
    }
  };

  const pickListingPhoto = async () => {
    if (listingPhotos.length >= 6) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setListingPhotos((prev) => [...prev, result.assets[0].uri].slice(0, 6));
    }
  };

  // ── Prompt helpers ─────────────────────────────────────────────────────────

  const isPromptSelected = (q: string) => promptAnswers.some((p) => p.question === q);

  const togglePrompt = (q: string) => {
    if (isPromptSelected(q)) {
      setPromptAnswers((prev) => prev.filter((p) => p.question !== q));
    } else if (promptAnswers.length < 3) {
      setPromptAnswers((prev) => [...prev, { question: q, answer: '' }]);
    }
  };

  const setPromptAnswer = (q: string, answer: string) => {
    setPromptAnswers((prev) =>
      prev.map((p) => (p.question === q ? { ...p, answer } : p))
    );
  };

  // ── Step renders ───────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <ScrollView style={styles.stepBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor="#9AA"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder="Age (optional)"
              placeholderTextColor="#9AA"
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              maxLength={3}
            />
            <Text style={styles.sectionLabel}>Gender</Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((g) => (
                <Chip
                  key={g}
                  label={g}
                  selected={gender === g}
                  onPress={() => setGender(gender === g ? '' : g)}
                />
              ))}
            </View>
            <Text style={styles.sectionLabel}>Ethnicity (optional)</Text>
            <View style={styles.chipRow}>
              {ETHNICITY_OPTIONS.map((e) => (
                <Chip
                  key={e}
                  label={e}
                  selected={ethnicity === e}
                  onPress={() => setEthnicity(ethnicity === e ? '' : e)}
                />
              ))}
            </View>
          </ScrollView>
        );

      case 1:
        return useLegacyLocationUi ? (
          <View style={styles.stepBody}>
            {isExpoGo && (
              <Text style={styles.hint}>
                Expo Go doesn't support Mapbox. Enter location manually, or run a dev build to use the map.
              </Text>
            )}
            <TextInput
              style={styles.input}
              placeholder="City"
              placeholderTextColor="#9AA"
              value={city}
              onChangeText={setCity}
            />
            <TextInput
              style={styles.input}
              placeholder="State (e.g. CA)"
              placeholderTextColor="#9AA"
              value={locationState}
              onChangeText={setLocationState}
              autoCapitalize="characters"
              maxLength={2}
            />
            <TextInput
              style={styles.input}
              placeholder="ZIP code (optional)"
              placeholderTextColor="#9AA"
              value={zipCode}
              onChangeText={setZipCode}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>
        ) : (
          <Suspense fallback={<ActivityIndicator color="#0C5389" style={{ marginVertical: 24 }} />}>
            <SearchAreaMapPicker onChange={setSearchArea} />
          </Suspense>
        );

      case 2: {
        const budgetError =
          minBudget && maxBudget && parseFloat(minBudget) > parseFloat(maxBudget)
            ? 'Min budget cannot exceed max budget'
            : '';
        const budgetKeyboardType = Platform.OS === 'ios' ? 'number-pad' : 'numeric';
        return (
          <ScrollView
            style={styles.stepBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          >
            <TextInput
              style={styles.input}
              placeholder="Min / month ($)"
              placeholderTextColor="#9AA"
              value={minBudget}
              onChangeText={setMinBudget}
              keyboardType={budgetKeyboardType}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => maxBudgetInputRef.current?.focus()}
            />
            <TextInput
              ref={maxBudgetInputRef}
              style={styles.input}
              placeholder="Max / month ($)"
              placeholderTextColor="#9AA"
              value={maxBudget}
              onChangeText={setMaxBudget}
              keyboardType={budgetKeyboardType}
              returnKeyType="done"
            />
            {!!budgetError && <Text style={styles.errorText}>{budgetError}</Text>}
          </ScrollView>
        );
      }

      case 3: {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return (
          <ScrollView style={styles.stepBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>Room type</Text>
            <View style={styles.chipRow}>
              {[
                { val: 'private',  label: 'Private Room' },
                { val: 'shared',   label: 'Shared Room' },
                { val: 'flexible', label: 'Either' },
                { val: 'entire',   label: 'Entire Place' },
              ].map(({ val, label }) => (
                <Chip
                  key={val}
                  label={label}
                  selected={roomType === val}
                  onPress={() => setRoomType(roomType === val ? '' : val)}
                />
              ))}
            </View>
            <Text style={styles.sectionLabel}>Move-in date (optional)</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={[styles.dateBtnText, !moveInDate && styles.dateBtnPlaceholder]}>
                {moveInDate ? formatDateDisplay(moveInDate) : 'Select a date'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={moveInDate ?? tomorrow}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={tomorrow}
                onChange={(event, date) => {
                  if (Platform.OS === 'android') {
                    setShowDatePicker(false);
                    if (event.type === 'set' && date) {
                      const d = new Date(date);
                      d.setHours(0, 0, 0, 0);
                      if (d > new Date()) setMoveInDate(date);
                    }
                  } else if (date) {
                    setMoveInDate(date);
                  }
                }}
              />
            )}
            {Platform.OS === 'ios' && showDatePicker && (
              <TouchableOpacity style={styles.dateDoneBtn} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.dateDoneBtnText}>Done</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        );
      }

      case 4:
        return (
          <ScrollView style={styles.stepBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>Cleanliness (1 = relaxed · 5 = spotless)</Text>
            <View style={styles.chipRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip
                  key={n}
                  label={String(n)}
                  selected={cleanliness === n}
                  onPress={() => setCleanliness(cleanliness === n ? null : n)}
                />
              ))}
            </View>
            <Text style={styles.sectionLabel}>Work schedule</Text>
            <View style={styles.chipRow}>
              {['9-to-5', 'Remote', 'Night Shift', 'Flexible'].map((s) => (
                <Chip
                  key={s}
                  label={s}
                  selected={workSchedule === s}
                  onPress={() => setWorkSchedule(workSchedule === s ? '' : s)}
                />
              ))}
            </View>
            <Text style={styles.sectionLabel}>Social vibe</Text>
            <View style={styles.chipRow}>
              {['Social Butterfly', 'Balanced', 'Homebody'].map((s) => (
                <Chip
                  key={s}
                  label={s}
                  selected={socialPref === s}
                  onPress={() => setSocialPref(socialPref === s ? '' : s)}
                />
              ))}
            </View>
            <Text style={styles.sectionLabel}>Pets</Text>
            <View style={styles.chipRow}>
              <Chip label="Yes" selected={petsAllowed === true} onPress={() => setPetsAllowed(petsAllowed === true ? null : true)} />
              <Chip label="No"  selected={petsAllowed === false} onPress={() => setPetsAllowed(petsAllowed === false ? null : false)} />
            </View>
            <Text style={styles.sectionLabel}>Smoking</Text>
            <View style={styles.chipRow}>
              <Chip label="Yes" selected={smokingAllowed === true} onPress={() => setSmokingAllowed(smokingAllowed === true ? null : true)} />
              <Chip label="No"  selected={smokingAllowed === false} onPress={() => setSmokingAllowed(smokingAllowed === false ? null : false)} />
            </View>
          </ScrollView>
        );

      case 5:
        return (
          <ScrollView style={styles.stepBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.hint}>Tap each row to set your preference.</Text>
            {DEALBREAKER_ITEMS.map(({ key, label }) => (
              <View key={key} style={styles.dbRow}>
                <Text style={styles.dbLabel}>{label}</Text>
                <View style={styles.dbChips}>
                  {(['hard', 'soft', 'none'] as DealbreakerLevel[]).map((level) => {
                    const selected = dealbreakers[key] === level;
                    return (
                      <TouchableOpacity
                        key={level}
                        style={[
                          styles.dbChip,
                          selected && level === 'hard' && styles.dbChipHard,
                          selected && level === 'soft' && styles.dbChipSoft,
                          selected && level === 'none' && styles.dbChipNone,
                        ]}
                        onPress={() => setDealbreakers((prev) => ({ ...prev, [key]: level }))}
                      >
                        <Text style={[styles.dbChipText, selected && styles.dbChipTextSelected]}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        );

      case 6:
        return (
          <ScrollView style={styles.stepBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {INTEREST_CATEGORIES.map(({ key, label, options }) => {
              const isOpen = expandedCategory === key;
              const selected = interests[key] ?? [];
              return (
                <View key={key} style={styles.catBlock}>
                  <TouchableOpacity
                    style={styles.catHeader}
                    onPress={() => setExpandedCategory(isOpen ? null : key)}
                  >
                    <Text style={styles.catLabel}>
                      {label}{selected.length > 0 ? `  (${selected.length})` : ''}
                    </Text>
                    <Text style={styles.catChevron}>{isOpen ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={styles.catContent}>
                      <View style={styles.chipRow}>
                        {options.map((opt) => (
                          <Chip
                            key={opt}
                            label={opt}
                            selected={selected.includes(opt)}
                            disabled={!selected.includes(opt) && selected.length >= 5}
                            onPress={() => {
                              setInterests((prev) => {
                                const cur = prev[key] ?? [];
                                if (cur.includes(opt)) return { ...prev, [key]: cur.filter((i) => i !== opt) };
                                if (cur.length >= 5) return prev;
                                return { ...prev, [key]: [...cur, opt] };
                              });
                            }}
                          />
                        ))}
                      </View>
                      <View style={styles.customInputRow}>
                        <TextInput
                          style={styles.customInput}
                          placeholder="+ Add custom"
                          placeholderTextColor="#9AA"
                          value={customInputs[key]}
                          onChangeText={(t) => setCustomInputs((prev) => ({ ...prev, [key]: t }))}
                          returnKeyType="done"
                          onSubmitEditing={() => {
                            const val = customInputs[key].trim();
                            if (!val) return;
                            setInterests((prev) => {
                              const cur = prev[key] ?? [];
                              if (cur.includes(val) || cur.length >= 5) return prev;
                              return { ...prev, [key]: [...cur, val] };
                            });
                            setCustomInputs((prev) => ({ ...prev, [key]: '' }));
                          }}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        );

      case 7:
        return (
          <ScrollView style={styles.stepBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.hint}>Tap a prompt to select it, then write your answer.</Text>
            <Text style={styles.promptCount}>{promptAnswers.length} / 3 selected</Text>
            {PROMPTS.map((q) => {
              const selected = isPromptSelected(q);
              const entry = promptAnswers.find((p) => p.question === q);
              const maxReached = !selected && promptAnswers.length >= 3;
              return (
                <View key={q} style={styles.promptBlock}>
                  <TouchableOpacity
                    style={[styles.promptRow, selected && styles.promptRowSelected, maxReached && styles.promptRowDimmed]}
                    onPress={() => !maxReached && togglePrompt(q)}
                    activeOpacity={maxReached ? 1 : 0.7}
                  >
                    <Text style={[styles.promptText, selected && styles.promptTextSelected]}>{q}</Text>
                    {selected && <Text style={styles.promptCheck}>✓</Text>}
                  </TouchableOpacity>
                  {selected && (
                    <TextInput
                      style={styles.promptInput}
                      placeholder="Your answer…"
                      placeholderTextColor="#9AA"
                      value={entry?.answer ?? ''}
                      onChangeText={(t) => setPromptAnswer(q, t)}
                      multiline
                      maxLength={300}
                    />
                  )}
                </View>
              );
            })}
          </ScrollView>
        );

      case 8:
        return (
          <ScrollView style={styles.stepBody} showsVerticalScrollIndicator={false}>
            <PublicProfileCard
              imageUrls={stagingUris}
              name={name.trim() || 'Your name'}
              age={age ? parseInt(age, 10) : null}
              location={[city.trim(), locationState.trim()].filter(Boolean).join(', ')}
            />
            <Text style={[styles.hint, { marginTop: 16 }]}>Add up to 4 photos. Tap + to add more.</Text>
            <View style={styles.photoGrid}>
              {stagingUris.map((uri, i) => (
                <View key={i} style={[styles.photoThumb, { width: PHOTO_THUMB, height: PHOTO_THUMB * 1.25 }]}>
                  <Image source={{ uri }} style={styles.photoImg} />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => setStagingUris((p) => p.filter((_, idx) => idx !== i))}>
                    <Text style={styles.photoRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {stagingUris.length < 4 && (
                <TouchableOpacity
                  style={[styles.photoAdd, { width: PHOTO_THUMB, height: PHOTO_THUMB * 1.25 }]}
                  onPress={pickProfilePhoto}
                >
                  <Text style={styles.photoAddIcon}>+</Text>
                  <Text style={styles.photoAddLabel}>Add photo</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.photoCount}>{stagingUris.length} / 4 photos</Text>
          </ScrollView>
        );

      case 9:
        return (
          <ScrollView style={styles.stepBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.hint}>Only fill this in if you have a room or place to offer.</Text>
            <View style={styles.chipRow}>
              <Chip
                label="I have a place to list"
                selected={hasListing}
                onPress={() => setHasListing(!hasListing)}
              />
            </View>
            {hasListing && (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Monthly rent ($)"
                  placeholderTextColor="#9AA"
                  value={listingRent}
                  onChangeText={setListingRent}
                  keyboardType="numeric"
                />
                <Text style={styles.sectionLabel}>Room type</Text>
                <View style={styles.chipRow}>
                  {[
                    { val: 'private', label: 'Private Room' },
                    { val: 'shared',  label: 'Shared Room' },
                    { val: 'entire',  label: 'Entire Place' },
                  ].map(({ val, label }) => (
                    <Chip
                      key={val}
                      label={label}
                      selected={listingRoomType === val}
                      onPress={() => setListingRoomType(listingRoomType === val ? '' : val)}
                    />
                  ))}
                </View>
                <TextInput style={styles.input} placeholder="Address" placeholderTextColor="#9AA" value={listingAddress} onChangeText={setListingAddress} />
                <TextInput style={styles.input} placeholder="City" placeholderTextColor="#9AA" value={listingCity} onChangeText={setListingCity} />
                <TextInput style={styles.input} placeholder="State (e.g. CA)" placeholderTextColor="#9AA" value={listingStateVal} onChangeText={setListingStateVal} autoCapitalize="characters" maxLength={2} />
                <TextInput style={styles.input} placeholder="ZIP code" placeholderTextColor="#9AA" value={listingZip} onChangeText={setListingZip} keyboardType="numeric" maxLength={5} />
                <Text style={styles.sectionLabel}>Photos (up to 6)</Text>
                <View style={styles.photoGrid}>
                  {listingPhotos.map((uri, i) => (
                    <View key={i} style={[styles.photoThumb, { width: PHOTO_THUMB, height: PHOTO_THUMB * 1.25 }]}>
                      <Image source={{ uri }} style={styles.photoImg} />
                      <TouchableOpacity style={styles.photoRemove} onPress={() => setListingPhotos((p) => p.filter((_, idx) => idx !== i))}>
                        <Text style={styles.photoRemoveText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {listingPhotos.length < 6 && (
                    <TouchableOpacity
                      style={[styles.photoAdd, { width: PHOTO_THUMB, height: PHOTO_THUMB * 1.25 }]}
                      onPress={pickListingPhoto}
                    >
                      <Text style={styles.photoAddIcon}>+</Text>
                      <Text style={styles.photoAddLabel}>Add photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        );

      default:
        return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isLastStep = step === TOTAL_STEPS - 1;
  const progress = (step + 1) / TOTAL_STEPS;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header: back arrow + progress bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            disabled={step === 0 || saving}
          >
            {step > 0 && <Text style={styles.backBtnText}>←</Text>}
          </TouchableOpacity>
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
            </View>
            <Text style={styles.progressLabel}>{step + 1} of {TOTAL_STEPS}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        {/* Step title + subtitle */}
        <View style={styles.titleBlock}>
          <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>
          <Text style={styles.stepSubtitle}>{STEP_SUBTITLES[step]}</Text>
        </View>

        {/* Step content */}
        {renderStep()}

        {/* Footer buttons */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={saving}>
            <Text style={styles.skipBtnText}>{isLastStep ? 'Finish' : 'Skip'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nextBtn, (!canAdvance() || saving) && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canAdvance() || saving}
          >
            {saving ? (
              <ActivityIndicator color="#FDFDFD" />
            ) : (
              <Text style={styles.nextBtnText}>{isLastStep ? 'Done' : 'Next'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E8EEF2',
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 24,
    color: '#0C5389',
  },
  progressWrap: {
    flex: 1,
    alignItems: 'center',
  },
  progressTrack: {
    height: 4,
    width: '100%',
    backgroundColor: '#D9E1E6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#189AA2',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    color: '#0C5389',
    marginTop: 4,
  },

  // Title block
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0C5389',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#7A8FA0',
    lineHeight: 20,
  },

  // Step body
  stepBody: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Inputs
  input: {
    backgroundColor: '#FDFDFD',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#0C5389',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0C5389',
    marginTop: 16,
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: '#7A8FA0',
    lineHeight: 18,
    marginBottom: 12,
    marginTop: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#E53E3E',
    marginBottom: 8,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D9E1E6',
    backgroundColor: '#FDFDFD',
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: '#189AA2',
    borderColor: '#189AA2',
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: 14,
    color: '#0C5389',
  },
  chipTextSelected: {
    color: '#FDFDFD',
    fontWeight: '600',
  },

  // Date picker
  dateBtn: {
    backgroundColor: '#FDFDFD',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  dateBtnText: {
    fontSize: 16,
    color: '#0C5389',
  },
  dateBtnPlaceholder: {
    color: '#9AA',
  },
  dateDoneBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#189AA2',
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  dateDoneBtnText: {
    color: '#FDFDFD',
    fontSize: 14,
    fontWeight: '600',
  },

  // Dealbreakers
  dbRow: {
    marginBottom: 14,
  },
  dbLabel: {
    fontSize: 15,
    color: '#0C5389',
    fontWeight: '500',
    marginBottom: 6,
  },
  dbChips: {
    flexDirection: 'row',
    gap: 8,
  },
  dbChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D9E1E6',
    backgroundColor: '#FDFDFD',
    alignItems: 'center',
  },
  dbChipHard: {
    backgroundColor: '#E53E3E',
    borderColor: '#E53E3E',
  },
  dbChipSoft: {
    backgroundColor: '#F6AD55',
    borderColor: '#F6AD55',
  },
  dbChipNone: {
    backgroundColor: '#189AA2',
    borderColor: '#189AA2',
  },
  dbChipText: {
    fontSize: 13,
    color: '#0C5389',
    fontWeight: '500',
  },
  dbChipTextSelected: {
    color: '#FDFDFD',
    fontWeight: '600',
  },

  // Interests accordion
  catBlock: {
    borderBottomWidth: 1,
    borderBottomColor: '#D9E1E6',
    marginBottom: 0,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  catLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C5389',
  },
  catChevron: {
    fontSize: 12,
    color: '#189AA2',
  },
  catContent: {
    paddingBottom: 8,
  },
  customInputRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  customInput: {
    backgroundColor: '#FDFDFD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0C5389',
  },

  // Prompts
  promptCount: {
    fontSize: 13,
    color: '#189AA2',
    fontWeight: '600',
    marginBottom: 12,
  },
  promptBlock: {
    marginBottom: 8,
  },
  promptRow: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D9E1E6',
    backgroundColor: '#FDFDFD',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promptRowSelected: {
    borderColor: '#189AA2',
    backgroundColor: '#EDF8F9',
  },
  promptRowDimmed: {
    opacity: 0.45,
  },
  promptText: {
    fontSize: 14,
    color: '#0C5389',
    flex: 1,
    lineHeight: 20,
  },
  promptTextSelected: {
    fontWeight: '500',
  },
  promptCheck: {
    fontSize: 16,
    color: '#189AA2',
    marginLeft: 8,
    fontWeight: '700',
  },
  promptInput: {
    backgroundColor: '#FDFDFD',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9E1E6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0C5389',
    marginTop: 4,
    minHeight: 70,
    textAlignVertical: 'top',
  },

  // Photos
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
    marginTop: 8,
  },
  photoThumb: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: {
    color: '#FDFDFD',
    fontSize: 12,
    fontWeight: '700',
  },
  photoAdd: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D9E1E6',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDFDFD',
  },
  photoAddIcon: {
    fontSize: 32,
    color: '#D9E1E6',
  },
  photoAddLabel: {
    fontSize: 12,
    color: '#7A8FA0',
    marginTop: 4,
  },
  photoCount: {
    fontSize: 13,
    color: '#7A8FA0',
    textAlign: 'center',
    marginBottom: 8,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 12,
    gap: 12,
    backgroundColor: '#E8EEF2',
  },
  skipBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#D9E1E6',
  },
  skipBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C5389',
  },
  nextBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#0C5389',
  },
  nextBtnDisabled: {
    opacity: 0.4,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FDFDFD',
  },
});
