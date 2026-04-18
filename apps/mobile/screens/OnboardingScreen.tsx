/**
 * OnboardingScreen — 17-step focused onboarding flow.
 * One or two inputs per screen, Hinge-style.
 *
 *  0  Name
 *  1  Age
 *  2  Gender          (chips, auto-advance)
 *  3  Ethnicity       (chips, optional)
 *  4  Location        (city + state + zip)
 *  5  Budget          (min + max)
 *  6  Room type       (chips, auto-advance)
 *  7  Move-in date
 *  8  Cleanliness     (1–5 chips, auto-advance)
 *  9  Work schedule   (chips, auto-advance)
 * 10  Social vibe     (chips, auto-advance)
 * 11  Pets & Smoking  (2 yes/no rows)
 * 12  Dealbreakers
 * 13  Interests
 * 14  Prompts
 * 15  Photos
 * 16  Listing         (optional)
 */

import { useState, useEffect, useRef, useCallback, lazy, Suspense, type ComponentType } from 'react';
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
  Modal,
  FlatList,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  User, Cake, Sparkle, Globe, MapPin, CurrencyDollar,
  Door, CalendarBlank, Broom, Clock, UsersThree, PawPrint,
  ShieldWarning, Star, ChatCircleDots, Camera, House,
  Prohibit, MusicNote, Sun, Moon, Bed,
  XCircle, MinusCircle, CheckCircle,
} from 'phosphor-react-native';
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

const TOTAL_STEPS = 17;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_THUMB = (SCREEN_WIDTH - 40 - 10) / 2;

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
  { key: 'smoking',    question: 'Smoking indoors in the unit?' },
  { key: 'pets',       question: 'Pets living in the unit?' },
  { key: 'parties',    question: 'Frequent house parties?' },
  { key: 'early_bird', question: 'Noise before 8 am?' },
  { key: 'night_owl',  question: 'Noise after 11 pm?' },
  { key: 'guests',     question: 'Overnight guests regularly?' },
];

const DB_OPTIONS: { level: DealbreakerLevel; label: string; sublabel: string }[] = [
  { level: 'hard', label: 'Never',        sublabel: "It's a dealbreaker for me" },
  { level: 'soft', label: 'Prefer not',   sublabel: "I'd rather avoid it" },
  { level: 'none', label: 'Fine with it', sublabel: "Doesn't bother me" },
];

const INTEREST_CATEGORIES = [
  {
    key: 'fitness',
    label: 'Fitness',
    options: ['Running', 'Yoga', 'Gym', 'Hiking', 'Swimming', 'Cycling', 'Rock Climbing'],
  },
  {
    key: 'food',
    label: 'Food & Drink',
    options: ['Cooking', 'Baking', 'Coffee', 'Wine & Cocktails', 'Foodie Adventures', 'Meal Prep'],
  },
  {
    key: 'arts',
    label: 'Arts & Culture',
    options: ['Movies', 'Music', 'Reading', 'Photography', 'Art Galleries', 'Theater'],
  },
  {
    key: 'outdoors',
    label: 'Outdoors',
    options: ['Camping', 'Travel', 'Beach', 'Gardening', 'Road Trips', 'Surfing'],
  },
  {
    key: 'tech',
    label: 'Tech & Gaming',
    options: ['Gaming', 'Coding', 'Podcasts', 'Anime', 'Board Games', 'VR / AR'],
  },
];

type PromptDef = { question: string; suggestions: string[] };

const PROMPTS: PromptDef[] = [
  {
    question: 'My ideal Saturday morning looks like…',
    suggestions: ['Coffee and a good book', 'Long run, then brunch', 'Farmers market & cooking', 'Sleeping in, zero plans'],
  },
  {
    question: "I'm looking for a roommate who…",
    suggestions: ['Respects quiet hours', 'Is tidy but chill', 'Actually uses the kitchen', 'Keeps to themselves'],
  },
  {
    question: "Don't room with me if you hate…",
    suggestions: ['Occasional music', 'My cooking smells', 'Short notice guests', 'Early mornings'],
  },
  {
    question: 'My morning routine is…',
    suggestions: ['Quick shower and go', 'Slow coffee and news', 'Gym before anything', 'Total chaos, honestly'],
  },
  {
    question: "On weeknights you'll find me…",
    suggestions: ['Cooking & winding down', 'Working late', 'Out with friends sometimes', 'Glued to my couch'],
  },
  {
    question: 'Weekends are for…',
    suggestions: ['Exploring the city', 'Recovering from the week', 'Hiking or outdoors', 'Brunching & errands'],
  },
  {
    question: 'I clean the apartment…',
    suggestions: ['Every Sunday without fail', 'When it starts to bother me', 'A little every day', 'Whenever I can'],
  },
  {
    question: 'My noise level is…',
    suggestions: ['Library quiet', 'Music on, low volume', 'TV always on in the background', 'Varies a lot'],
  },
  {
    question: 'Overnight guests are…',
    suggestions: ['Rare and I give notice', 'Pretty common, sorry', 'Never really', 'Occasional & respectful'],
  },
  {
    question: 'My kitchen rule is…',
    suggestions: ['Clean as you go', 'Dishes done before bed', 'Shared is cared', 'My stuff = my shelf'],
  },
  {
    question: 'My sleep schedule is…',
    suggestions: ['Lights out by 10pm', 'Night owl til 2am+', 'All over the place', 'Up at 6, bed by midnight'],
  },
  {
    question: "I've lived with roommates before and learned…",
    suggestions: ['Communication is everything', 'Label your food', 'Set expectations early', 'Alone time is sacred'],
  },
  {
    question: 'A quirk about living with me…',
    suggestions: ["I organize when I'm stressed", 'I hum while cooking', 'I keep the thermostat cold', 'I rearrange furniture a lot'],
  },
  {
    question: 'My ideal apartment vibe…',
    suggestions: ['Clean, minimal, calm', 'Cozy and lived-in', 'Like a coffee shop', 'Wherever my stuff is'],
  },
  {
    question: 'After work I usually…',
    suggestions: ['Decompress alone first', 'Hit the gym', 'Cook something', 'Jump on calls with friends'],
  },
  {
    question: 'The best thing about me as a roommate…',
    suggestions: ["I'm low drama", "I'm always down to help", 'I mind my own business', "I'll actually clean"],
  },
  {
    question: 'My work-from-home setup is…',
    suggestions: ['Headphones in, do not disturb', 'Calls all day, heads up', 'I go into the office', 'Mix of both'],
  },
  {
    question: 'Two truths and a lie about my living habits…',
    suggestions: ['Write your own answer…'],
  },
  {
    question: 'I stay up until…',
    suggestions: ['10–11pm usually', 'Midnight most nights', '2am is normal for me', 'Whenever I pass out'],
  },
  {
    question: 'I wake up at…',
    suggestions: ['6am, I am that person', '7–8am if I have to', '9am on a good day', 'Whenever my body decides'],
  },
  {
    question: 'My relationship with mess is…',
    suggestions: ['It stresses me out', 'Clutter = creativity', 'Clean surfaces, chaotic drawers', 'Depends on the week'],
  },
  {
    question: 'The soundtrack of my home is…',
    suggestions: ['Complete silence', 'Lo-fi or chill beats', 'Whatever podcast is on', 'TV as background noise'],
  },
  {
    question: 'My go-to snack situation…',
    suggestions: ['Snack drawer fully stocked', 'I meal prep everything', 'Whatever is around', 'I barely eat at home'],
  },
  {
    question: 'I unwind by…',
    suggestions: ['Reading or journaling', 'Working out', 'Watching something', 'Just lying down honestly'],
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StepDef = { icon: ComponentType<any>; question: string; subtitle: string; optional?: boolean };

// Per-step display content
const STEPS: StepDef[] = [
  { icon: User,          question: "What's your name?",               subtitle: "This is how you'll appear to others." },
  { icon: Cake,          question: 'How old are you?',                subtitle: 'You must be 18+ to use RoomPear.' },
  { icon: Sparkle,       question: 'How do you identify?',            subtitle: 'Helps personalize your matches.' },
  { icon: Globe,         question: "What's your ethnicity?",          subtitle: 'Optional — skip if you prefer not to say.', optional: true },
  { icon: MapPin,        question: 'Where are you looking?',          subtitle: "We'll show you people in your area." },
  { icon: CurrencyDollar,question: "What's your monthly budget?",     subtitle: 'Your comfortable range for rent.' },
  { icon: Door,          question: 'What kind of room?',              subtitle: 'Pick what works for you.' },
  { icon: CalendarBlank, question: 'When do you want to move in?',    subtitle: 'Approximate is fine — you can update later.', optional: true },
  { icon: Broom,         question: 'How clean do you keep your space?',subtitle: '1 = relaxed about mess  ·  5 = spotless' },
  { icon: Clock,         question: "What's your work schedule?",      subtitle: 'Helps us find someone on your rhythm.' },
  { icon: UsersThree,    question: "What's your social vibe?",        subtitle: 'How often do you have people over?' },
  { icon: PawPrint,      question: 'A quick yes or no…',              subtitle: 'These filter out incompatible matches.' },
  { icon: ShieldWarning, question: 'Any dealbreakers?',               subtitle: 'Hard = never  ·  Soft = prefer not  ·  None = fine', optional: true },
  { icon: Star,          question: 'What are you into?',              subtitle: 'Select up to 5 per category.', optional: true },
  { icon: ChatCircleDots,question: 'In your own words…',              subtitle: 'Pick 2–3 prompts to answer.', optional: true },
  { icon: Camera,        question: 'Show yourself off',               subtitle: 'Your first photo is your first impression.' },
  { icon: House,         question: 'Got a place to offer?',           subtitle: 'Optional — skip if you are only looking.', optional: true },
];

// Steps that auto-advance when a chip is selected
const AUTO_ADVANCE_STEPS = new Set([2, 3, 6, 8, 9, 10, 12]);

const US_STATES = [
  { label: 'Alabama', abbr: 'AL' }, { label: 'Alaska', abbr: 'AK' },
  { label: 'Arizona', abbr: 'AZ' }, { label: 'Arkansas', abbr: 'AR' },
  { label: 'California', abbr: 'CA' }, { label: 'Colorado', abbr: 'CO' },
  { label: 'Connecticut', abbr: 'CT' }, { label: 'Delaware', abbr: 'DE' },
  { label: 'Florida', abbr: 'FL' }, { label: 'Georgia', abbr: 'GA' },
  { label: 'Hawaii', abbr: 'HI' }, { label: 'Idaho', abbr: 'ID' },
  { label: 'Illinois', abbr: 'IL' }, { label: 'Indiana', abbr: 'IN' },
  { label: 'Iowa', abbr: 'IA' }, { label: 'Kansas', abbr: 'KS' },
  { label: 'Kentucky', abbr: 'KY' }, { label: 'Louisiana', abbr: 'LA' },
  { label: 'Maine', abbr: 'ME' }, { label: 'Maryland', abbr: 'MD' },
  { label: 'Massachusetts', abbr: 'MA' }, { label: 'Michigan', abbr: 'MI' },
  { label: 'Minnesota', abbr: 'MN' }, { label: 'Mississippi', abbr: 'MS' },
  { label: 'Missouri', abbr: 'MO' }, { label: 'Montana', abbr: 'MT' },
  { label: 'Nebraska', abbr: 'NE' }, { label: 'Nevada', abbr: 'NV' },
  { label: 'New Hampshire', abbr: 'NH' }, { label: 'New Jersey', abbr: 'NJ' },
  { label: 'New Mexico', abbr: 'NM' }, { label: 'New York', abbr: 'NY' },
  { label: 'North Carolina', abbr: 'NC' }, { label: 'North Dakota', abbr: 'ND' },
  { label: 'Ohio', abbr: 'OH' }, { label: 'Oklahoma', abbr: 'OK' },
  { label: 'Oregon', abbr: 'OR' }, { label: 'Pennsylvania', abbr: 'PA' },
  { label: 'Rhode Island', abbr: 'RI' }, { label: 'South Carolina', abbr: 'SC' },
  { label: 'South Dakota', abbr: 'SD' }, { label: 'Tennessee', abbr: 'TN' },
  { label: 'Texas', abbr: 'TX' }, { label: 'Utah', abbr: 'UT' },
  { label: 'Vermont', abbr: 'VT' }, { label: 'Virginia', abbr: 'VA' },
  { label: 'Washington', abbr: 'WA' }, { label: 'West Virginia', abbr: 'WV' },
  { label: 'Wisconsin', abbr: 'WI' }, { label: 'Wyoming', abbr: 'WY' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  label, selected, onPress, disabled,
}: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
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

interface Props { onComplete: () => void }

export default function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 0: Name
  const [name, setName] = useState('');
  // Step 1: Age
  const [age, setAge] = useState('');
  // Step 2: Gender
  const [gender, setGender] = useState('');
  // Step 3: Ethnicity
  const [ethnicity, setEthnicity] = useState('');
  // Step 4: Location
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const useLegacyLocationUi = !Constants.expoConfig?.extra?.mapboxAccessToken || isExpoGo;
  const [city, setCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [searchArea, setSearchArea] = useState<SearchAreaValue | null>(null);
  // Step 5: Budget
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const maxBudgetRef = useRef<TextInput>(null);
  // Step 6: Room type
  const [roomType, setRoomType] = useState('');
  // Step 7: Move-in date
  const [moveInDate, setMoveInDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Step 8: Cleanliness
  const [cleanliness, setCleanliness] = useState<number | null>(null);
  // Step 9: Work schedule
  const [workSchedule, setWorkSchedule] = useState('');
  // Step 10: Social vibe
  const [socialPref, setSocialPref] = useState('');
  // Step 11: Pets & Smoking
  const [petsAllowed, setPetsAllowed] = useState<boolean | null>(null);
  const [smokingAllowed, setSmokingAllowed] = useState<boolean | null>(null);
  // Step 12: Dealbreakers (sub-flow)
  const [dealbreakers, setDealbreakers] = useState<Record<string, DealbreakerLevel>>(
    Object.fromEntries(DEALBREAKER_ITEMS.map((d) => [d.key, 'none' as DealbreakerLevel]))
  );
  const [dbStep, setDbStep] = useState(0);
  const [dbSelected, setDbSelected] = useState<DealbreakerLevel | null>(null);
  const dbCardAnim = useRef(new Animated.Value(1)).current;
  // Step 13: Interests
  const [interests, setInterests] = useState<Record<string, string[]>>(
    Object.fromEntries(INTEREST_CATEGORIES.map((c) => [c.key, [] as string[]]))
  );
  const [expandedCategory, setExpandedCategory] = useState<string | null>('fitness');
  const [customInputs, setCustomInputs] = useState<Record<string, string>>(
    Object.fromEntries(INTEREST_CATEGORIES.map((c) => [c.key, '']))
  );
  // Step 14: Prompts (card sub-flow)
  const [promptAnswers, setPromptAnswers] = useState<PromptEntry[]>([]);
  const [promptCardIdx, setPromptCardIdx] = useState(0);
  const [promptMode, setPromptMode] = useState<'browse' | 'answer'>('browse');
  const [promptDraft, setPromptDraft] = useState('');
  const promptSlide = useRef(new Animated.Value(0)).current;
  const promptFade  = useRef(new Animated.Value(1)).current;
  // Step 15: Photos
  const [stagingUris, setStagingUris] = useState<string[]>([]);
  // Step 16: Listing
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
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

  // ── Auto-advance ────────────────────────────────────────────────────────────

  const scheduleAutoAdvance = useCallback(() => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setTimeout(() => {
      setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    }, 380);
  }, []);

  // ── Save helpers ────────────────────────────────────────────────────────────

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
    const { error } = await supabase.from('profiles').update({ prompts: filtered }).eq('id', userId);
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
    if (!userId) { Alert.alert('Error', 'Not signed in. Please restart the app.'); setSaving(false); return; }
    try {
      if (hasListing) {
        const photoPaths: string[] = [];
        for (const uri of listingPhotos) {
          const { path, error } = await uploadProfileImage(userId, uri);
          if (error || !path) { Alert.alert('Upload failed', 'Could not upload a listing photo.'); setSaving(false); return; }
          photoPaths.push(path);
        }
        await supabase.from('listings').insert({
          user_id: userId,
          rent: listingRent ? parseFloat(listingRent) : null,
          room_type: listingRoomType || null,
          address: listingAddress || null,
          city: listingCity || null,
          state: listingStateVal || null,
          zip_code: listingZip || null,
          listing_photos: photoPaths,
        });
        await supabase.from('profiles').update({ has_listing: true }).eq('id', userId);
      }

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
          ? (roomType as 'private' | 'shared' | 'flexible' | 'entire') : undefined,
        move_in_date: moveInDate ? formatDateYMD(moveInDate) : undefined,
        pets_allowed: petsAllowed ?? undefined,
        smoking_allowed: smokingAllowed ?? undefined,
        cleanliness_level: cleanliness ?? undefined,
        work_schedule: workSchedule || undefined,
        social_preference: socialPrefMapped as any,
        interests: Object.values(interests).some((v) => v.length > 0) ? interests : undefined,
        dealbreakers,
      });

      if (!result.success) { Alert.alert('Error', result.error ?? 'Could not save preferences.'); setSaving(false); return; }
      onComplete();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  };

  // ── Navigation ──────────────────────────────────────────────────────────────

  const handleBack = () => {
    if (saving) return;
    if (step === 12 && dbStep > 0) { setDbStep((s) => s - 1); setDbSelected(null); }
    else if (step === 14 && promptMode === 'answer') { setPromptMode('browse'); setPromptDraft(''); }
    else setStep((s) => Math.max(s - 1, 0));
  };

  const selectDealbreaker = (level: DealbreakerLevel) => {
    const key = DEALBREAKER_ITEMS[dbStep].key;
    setDbSelected(level);
    setDealbreakers((p) => ({ ...p, [key]: level }));
    Animated.sequence([
      Animated.timing(dbCardAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(dbCardAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      setDbSelected(null);
      if (dbStep < DEALBREAKER_ITEMS.length - 1) {
        setDbStep((s) => s + 1);
      } else {
        setDbStep(0);
        setStep((s) => s + 1);
      }
    }, 400);
  };

  const handleNext = async () => {
    if (saving) return;
    if (step === TOTAL_STEPS - 1) { setSaving(true); await handleComplete(); return; }

    setSaving(true);
    try {
      if (step === 3) {
        // End of about-you steps — save profile
        const ok = await saveAboutYou();
        if (!ok) { Alert.alert('Error', 'Could not save your info. Please try again.'); return; }
      } else if (step === 14) {
        await savePrompts();
      } else if (step === 15) {
        const ok = await uploadPhotos();
        if (!ok) return;
      }
      setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    } finally {
      setSaving(false);
    }
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const canAdvance = (): boolean => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return age === '' || parseInt(age, 10) >= 18;
    if (step === 5) {
      if (!minBudget.trim() || !maxBudget.trim()) return false;
      return parseFloat(minBudget) <= parseFloat(maxBudget);
    }
    if (step === 15) return stagingUris.length >= 1;
    return true;
  };

  // ── Photo pickers ────────────────────────────────────────────────────────────

  const pickProfilePhoto = async () => {
    if (stagingUris.length >= 4) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo library access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85, allowsEditing: true, aspect: [4, 5] });
    if (!result.canceled && result.assets[0]) setStagingUris((p) => [...p, result.assets[0].uri].slice(0, 4));
  };

  const pickListingPhoto = async () => {
    if (listingPhotos.length >= 6) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo library access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85 });
    if (!result.canceled && result.assets[0]) setListingPhotos((p) => [...p, result.assets[0].uri].slice(0, 6));
  };

  // ── Prompt helpers ────────────────────────────────────────────────────────────

  const isPromptSelected = (q: string) => promptAnswers.some((p) => p.question === q);

  const advancePromptCard = (direction: 'skip' | 'use') => {
    if (direction === 'use') {
      setPromptDraft('');
      setPromptMode('answer');
      return;
    }
    // Slide current card out left, bring next in from right
    Animated.parallel([
      Animated.timing(promptSlide, { toValue: -SCREEN_WIDTH, duration: 240, useNativeDriver: true }),
      Animated.timing(promptFade,  { toValue: 0,             duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setPromptCardIdx((i) => {
        // Skip already-answered prompts
        let next = (i + 1) % PROMPTS.length;
        let tries = 0;
        while (isPromptSelected(PROMPTS[next].question) && tries < PROMPTS.length) {
          next = (next + 1) % PROMPTS.length;
          tries++;
        }
        return next;
      });
      promptSlide.setValue(SCREEN_WIDTH * 0.4);
      promptFade.setValue(0);
      Animated.parallel([
        Animated.timing(promptSlide, { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(promptFade,  { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const savePromptAnswer = () => {
    const answer = promptDraft.trim();
    if (!answer) return;
    const question = PROMPTS[promptCardIdx].question;
    setPromptAnswers((p) => {
      const exists = p.find((x) => x.question === question);
      if (exists) return p.map((x) => x.question === question ? { ...x, answer } : x);
      if (p.length >= 3) return p;
      return [...p, { question, answer }];
    });
    setPromptMode('browse');
    setPromptDraft('');
    // Advance to next unanswered prompt
    advancePromptCard('skip');
  };

  // ── Step renders ─────────────────────────────────────────────────────────────

  const renderStepContent = () => {
    switch (step) {

      // 0: Name
      case 0:
        return (
          <View style={styles.focusInput}>
            <TextInput
              style={styles.heroInput}
              placeholder="Your name"
              placeholderTextColor={D.grayDim}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => canAdvance() && handleNext()}
            />
          </View>
        );

      // 1: Age
      case 1: {
        const ageNum = parseInt(age, 10);
        const ageTooYoung = age.length > 0 && !isNaN(ageNum) && ageNum < 18;
        return (
          <View style={styles.focusInput}>
            {ageTooYoung && (
              <Text style={[styles.errorText, { marginBottom: 8 }]}>You must be 18 or older to use RoomPear.</Text>
            )}
            <TextInput
              style={styles.heroInput}
              placeholder="Your age"
              placeholderTextColor={D.grayDim}
              value={age}
              onChangeText={(t) => {
                const digits = t.replace(/\D/g, '');
                if (digits === '' || parseInt(digits, 10) <= 130) setAge(digits);
              }}
              keyboardType="number-pad"
              maxLength={3}
              autoFocus
            />
          </View>
        );
      }

      // 2: Gender (auto-advance)
      case 2:
        return (
          <View style={styles.chipArea}>
            {GENDER_OPTIONS.map((g) => (
              <Chip
                key={g}
                label={g}
                selected={gender === g}
                onPress={() => { setGender(g); scheduleAutoAdvance(); }}
              />
            ))}
          </View>
        );

      // 3: Ethnicity (optional)
      case 3:
        return (
          <View style={styles.chipArea}>
            {ETHNICITY_OPTIONS.map((e) => (
              <Chip
                key={e}
                label={e}
                selected={ethnicity === e}
                onPress={() => { setEthnicity(ethnicity === e ? '' : e); scheduleAutoAdvance(); }}
              />
            ))}
          </View>
        );

      // 4: Location
      case 4: {
        const filteredStates = US_STATES.filter(
          (s) =>
            s.label.toLowerCase().includes(stateSearch.toLowerCase()) ||
            s.abbr.toLowerCase().includes(stateSearch.toLowerCase())
        );
        const selectedStateLabel = US_STATES.find((s) => s.abbr === locationState)?.label ?? '';

        return useLegacyLocationUi ? (
          <View style={styles.inputStack}>
            {/* State picker trigger */}
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => { setStateSearch(''); setShowStatePicker(true); }}
            >
              <Text style={locationState ? styles.pickerBtnText : styles.pickerBtnPlaceholder}>
                {selectedStateLabel || 'Select a state'}
              </Text>
              <Text style={styles.pickerChevron}>▼</Text>
            </TouchableOpacity>

            {/* City — only enabled after state chosen */}
            <TextInput
              style={[styles.input, !locationState && styles.inputDisabled]}
              placeholder={locationState ? `City in ${selectedStateLabel}` : 'City (choose state first)'}
              placeholderTextColor={D.grayDim}
              value={city}
              onChangeText={setCity}
              editable={!!locationState}
              returnKeyType="next"
            />

            {/* ZIP — optional */}
            <TextInput
              style={[styles.input, !locationState && styles.inputDisabled]}
              placeholder="ZIP code (optional)"
              placeholderTextColor={D.grayDim}
              value={zipCode}
              onChangeText={(t) => setZipCode(t.replace(/\D/g, '').slice(0, 5))}
              keyboardType="number-pad"
              editable={!!locationState}
            />

            {/* State picker modal */}
            <Modal
              visible={showStatePicker}
              animationType="slide"
              transparent
              onRequestClose={() => setShowStatePicker(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalSheet}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select a state</Text>
                    <TouchableOpacity onPress={() => setShowStatePicker(false)}>
                      <Text style={styles.modalClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.modalSearch}
                    placeholder="Search states…"
                    placeholderTextColor={D.grayDim}
                    value={stateSearch}
                    onChangeText={setStateSearch}
                    autoFocus
                  />
                  <FlatList
                    data={filteredStates}
                    keyExtractor={(s) => s.abbr}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.stateRow, locationState === item.abbr && styles.stateRowSelected]}
                        onPress={() => {
                          setLocationState(item.abbr);
                          setCity('');
                          setShowStatePicker(false);
                        }}
                      >
                        <Text style={[styles.stateRowText, locationState === item.abbr && styles.stateRowTextSelected]}>
                          {item.label}
                        </Text>
                        <Text style={styles.stateRowAbbr}>{item.abbr}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </View>
            </Modal>
          </View>
        ) : (
          <Suspense fallback={<ActivityIndicator color={D.lime} style={{ marginVertical: 24 }} />}>
            <SearchAreaMapPicker onChange={setSearchArea} />
          </Suspense>
        );
      }

      // 5: Budget
      case 5: {
        const budgetError =
          minBudget && maxBudget && parseFloat(minBudget) > parseFloat(maxBudget)
            ? 'Max budget must be greater than or equal to min'
            : '';
        const kbType = Platform.OS === 'ios' ? 'number-pad' : 'numeric';
        return (
          <View style={styles.inputStack}>
            <TextInput
              style={styles.input}
              placeholder="Min / month ($)"
              placeholderTextColor={D.grayDim}
              value={minBudget}
              onChangeText={setMinBudget}
              keyboardType={kbType}
              autoFocus
            />
            <TextInput
              ref={maxBudgetRef}
              style={styles.input}
              placeholder="Max / month ($)"
              placeholderTextColor={D.grayDim}
              value={maxBudget}
              onChangeText={setMaxBudget}
              keyboardType={kbType}
            />
            {!!budgetError && <Text style={styles.errorText}>{budgetError}</Text>}
          </View>
        );
      }

      // 6: Room type (auto-advance)
      case 6:
        return (
          <View style={styles.chipArea}>
            {[
              { val: 'private',  label: 'Private Room' },
              { val: 'shared',   label: 'Shared Room' },
              { val: 'flexible', label: 'Either works' },
              { val: 'entire',   label: 'Entire Place' },
            ].map(({ val, label }) => (
              <Chip
                key={val}
                label={label}
                selected={roomType === val}
                onPress={() => { setRoomType(val); scheduleAutoAdvance(); }}
              />
            ))}
          </View>
        );

      // 7: Move-in date
      case 7: {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return (
          <View style={styles.inputStack}>
            {Platform.OS === 'ios' ? (
              <View style={styles.datePickerWrap}>
                <DateTimePicker
                  value={moveInDate ?? tomorrow}
                  mode="date"
                  display="spinner"
                  minimumDate={tomorrow}
                  themeVariant="dark"
                  style={{ width: '100%' }}
                  onChange={(_, date) => { if (date) setMoveInDate(date); }}
                />
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                  <Text style={[styles.dateBtnText, !moveInDate && styles.dateBtnPlaceholder]}>
                    {moveInDate ? formatDateDisplay(moveInDate) : 'Select a date'}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={moveInDate ?? tomorrow}
                    mode="date"
                    display="default"
                    minimumDate={tomorrow}
                    onChange={(event, date) => {
                      setShowDatePicker(false);
                      if (event.type === 'set' && date) { const d = new Date(date); d.setHours(0,0,0,0); if (d > new Date()) setMoveInDate(date); }
                    }}
                  />
                )}
              </>
            )}
          </View>
        );
      }

      // 8: Cleanliness (auto-advance)
      case 8:
        return (
          <View style={styles.scaleArea}>
            <View style={styles.scaleLabels}>
              <Text style={styles.scaleLabel}>Relaxed</Text>
              <Text style={styles.scaleLabel}>Spotless</Text>
            </View>
            <View style={styles.scaleChips}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.scaleChip, cleanliness === n && styles.scaleChipSelected]}
                  onPress={() => {
                    setCleanliness(n);
                    scheduleAutoAdvance();
                  }}
                >
                  <Text style={[styles.scaleChipText, cleanliness === n && styles.scaleChipTextSelected]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      // 9: Work schedule (auto-advance)
      case 9:
        return (
          <View style={styles.chipArea}>
            {[
              { val: '9-to-5',    label: '9 to 5' },
              { val: 'Remote',    label: 'Remote / WFH' },
              { val: 'Night Shift', label: 'Night Shift' },
              { val: 'Flexible',  label: 'Flexible' },
            ].map(({ val, label }) => (
              <Chip
                key={val}
                label={label}
                selected={workSchedule === val}
                onPress={() => {
                  setWorkSchedule(val);
                  scheduleAutoAdvance();
                }}
              />
            ))}
          </View>
        );

      // 10: Social vibe (auto-advance)
      case 10:
        return (
          <View style={styles.chipArea}>
            {[
              { val: 'Social Butterfly', label: 'Social Butterfly' },
              { val: 'Balanced',         label: 'Balanced' },
              { val: 'Homebody',         label: 'Homebody' },
            ].map(({ val, label }) => (
              <Chip
                key={val}
                label={label}
                selected={socialPref === val}
                onPress={() => {
                  setSocialPref(val);
                  scheduleAutoAdvance();
                }}
              />
            ))}
          </View>
        );

      // 11: Pets & Smoking
      case 11:
        return (
          <View style={styles.yesNoArea}>
            <View style={styles.yesNoRow}>
              <Text style={styles.yesNoLabel}>Pets okay?</Text>
              <View style={styles.yesNoChips}>
                <Chip label="Yes" selected={petsAllowed === true}  onPress={() => setPetsAllowed(petsAllowed === true ? null : true)} />
                <Chip label="No"  selected={petsAllowed === false} onPress={() => setPetsAllowed(petsAllowed === false ? null : false)} />
              </View>
            </View>
            <View style={styles.yesNoRow}>
              <Text style={styles.yesNoLabel}>Smoking okay?</Text>
              <View style={styles.yesNoChips}>
                <Chip label="Yes" selected={smokingAllowed === true}  onPress={() => setSmokingAllowed(smokingAllowed === true ? null : true)} />
                <Chip label="No"  selected={smokingAllowed === false} onPress={() => setSmokingAllowed(smokingAllowed === false ? null : false)} />
              </View>
            </View>
          </View>
        );

      // 12: Dealbreakers (card sub-flow — one question at a time)
      case 12:
        return (
          <Animated.View style={[styles.dbCardArea, { transform: [{ scale: dbCardAnim }] }]}>
            {/* Sub-progress dots */}
            <View style={styles.dbDots}>
              {DEALBREAKER_ITEMS.map((_, i) => (
                <View key={i} style={[styles.dbDot, i === dbStep && styles.dbDotActive, i < dbStep && styles.dbDotDone]} />
              ))}
            </View>

            {/* Option cards */}
            {DB_OPTIONS.map(({ level, label, sublabel }) => {
              const isSelected = dbSelected === level;
              return (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.dbCard,
                    isSelected && level === 'hard' && styles.dbCardHard,
                    isSelected && level === 'soft' && styles.dbCardSoft,
                    isSelected && level === 'none' && styles.dbCardNone,
                  ]}
                  onPress={() => selectDealbreaker(level)}
                  activeOpacity={0.8}
                >
                  <View style={styles.dbCardText}>
                    <Text style={[styles.dbCardLabel, isSelected && styles.dbCardLabelSelected]}>{label}</Text>
                    <Text style={styles.dbCardSub}>{sublabel}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        );

      // 13: Interests
      case 13:
        return (
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {INTEREST_CATEGORIES.map(({ key, label, options }) => {
              const isOpen = expandedCategory === key;
              const selected = interests[key] ?? [];
              return (
                <View key={key} style={styles.catBlock}>
                  <TouchableOpacity style={styles.catHeader} onPress={() => setExpandedCategory(isOpen ? null : key)}>
                    <Text style={styles.catLabel}>{label}{selected.length > 0 ? `  (${selected.length})` : ''}</Text>
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
                            onPress={() => setInterests((p) => {
                              const cur = p[key] ?? [];
                              if (cur.includes(opt)) return { ...p, [key]: cur.filter((i) => i !== opt) };
                              if (cur.length >= 5) return p;
                              return { ...p, [key]: [...cur, opt] };
                            })}
                          />
                        ))}
                      </View>
                      <View style={styles.customInputRow}>
                        <TextInput
                          style={styles.customInput}
                          placeholder="+ Add your own"
                          placeholderTextColor={D.grayDim}
                          value={customInputs[key]}
                          onChangeText={(t) => setCustomInputs((p) => ({ ...p, [key]: t }))}
                          returnKeyType="done"
                          onSubmitEditing={() => {
                            const val = customInputs[key].trim();
                            if (!val) return;
                            setInterests((p) => {
                              const cur = p[key] ?? [];
                              if (cur.includes(val) || cur.length >= 5) return p;
                              return { ...p, [key]: [...cur, val] };
                            });
                            setCustomInputs((p) => ({ ...p, [key]: '' }));
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

      // 14: Prompts (card sub-flow)
      case 14: {
        const currentPrompt = PROMPTS[promptCardIdx];
        const done = promptAnswers.length;
        const maxDone = done >= 3;

        if (promptMode === 'answer') {
          return (
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Question header */}
                <View style={styles.pAnswerHeader}>
                  <Text style={styles.pAnswerQuestion}>{currentPrompt.question}</Text>
                </View>

                {/* Suggestions */}
                <Text style={styles.pSuggestLabel}>Tap a suggestion or write your own</Text>
                <View style={styles.pSuggestList}>
                  {currentPrompt.suggestions.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.pSuggestChip, promptDraft === s && styles.pSuggestChipActive]}
                      onPress={() => setPromptDraft(s)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.pSuggestText, promptDraft === s && styles.pSuggestTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom input */}
                <TextInput
                  style={styles.pDraftInput}
                  placeholder="Write your own answer…"
                  placeholderTextColor={D.grayDim}
                  value={promptDraft}
                  onChangeText={setPromptDraft}
                  multiline
                  maxLength={300}
                  autoFocus={currentPrompt.suggestions.length === 1}
                />
                <Text style={styles.pCharCount}>{promptDraft.length} / 300</Text>

                {/* Save button */}
                <TouchableOpacity
                  style={[styles.pSaveBtn, !promptDraft.trim() && styles.pSaveBtnDisabled]}
                  onPress={savePromptAnswer}
                  disabled={!promptDraft.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pSaveBtnText}>Save answer</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          );
        }

        // Browse mode
        return (
          <View style={{ flex: 1 }}>
            {/* Progress */}
            <View style={styles.pProgressRow}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.pProgressDot, i < done && styles.pProgressDotDone]} />
              ))}
              <Text style={styles.pProgressText}>
                {done === 0 ? 'Pick up to 3 prompts' : done === 3 ? '3 / 3 — you\'re done!' : `${done} / 3 completed`}
              </Text>
            </View>

            {/* Card */}
            <Animated.View
              style={[styles.pCard, { opacity: promptFade, transform: [{ translateX: promptSlide }] }]}
            >
              <Text style={styles.pCardQuestion}>{currentPrompt.question}</Text>
              {isPromptSelected(currentPrompt.question) && (
                <View style={styles.pCardDoneBadge}>
                  <Text style={styles.pCardDoneBadgeText}>Answered</Text>
                </View>
              )}
            </Animated.View>

            {/* Actions */}
            <View style={styles.pActions}>
              <TouchableOpacity style={styles.pSkipBtn} onPress={() => advancePromptCard('skip')} activeOpacity={0.7}>
                <Text style={styles.pSkipBtnText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pUseBtn, maxDone && styles.pUseBtnDisabled]}
                onPress={() => !maxDone && advancePromptCard('use')}
                disabled={maxDone}
                activeOpacity={0.8}
              >
                <Text style={styles.pUseBtnText}>{maxDone ? 'All done!' : 'Use this prompt'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      // 15: Photos
      case 15:
        return (
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            <PublicProfileCard
              imageUrls={stagingUris}
              name={name.trim() || 'Your name'}
              age={age ? parseInt(age, 10) : null}
              location={[city.trim(), locationState.trim()].filter(Boolean).join(', ')}
            />
            <Text style={[styles.hint, { marginTop: 14 }]}>Add up to 4 photos. Tap + to add.</Text>
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
                <TouchableOpacity style={[styles.photoAdd, { width: PHOTO_THUMB, height: PHOTO_THUMB * 1.25 }]} onPress={pickProfilePhoto}>
                  <Text style={styles.photoAddIcon}>+</Text>
                  <Text style={styles.photoAddLabel}>Add photo</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.photoCount}>{stagingUris.length} / 4 photos</Text>
          </ScrollView>
        );

      // 16: Listing (optional)
      case 16:
        return (
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.chipRow}>
              <Chip label="Yes, I have a place to list" selected={hasListing} onPress={() => setHasListing(!hasListing)} />
            </View>
            {hasListing && (
              <View>
                <TextInput style={styles.input} placeholder="Monthly rent ($)" placeholderTextColor={D.grayDim} value={listingRent} onChangeText={setListingRent} keyboardType="numeric" />
                <Text style={styles.sectionLabel}>Room type</Text>
                <View style={styles.chipRow}>
                  {[{ val: 'private', label: 'Private Room' }, { val: 'shared', label: 'Shared Room' }, { val: 'entire', label: 'Entire Place' }].map(({ val, label }) => (
                    <Chip key={val} label={label} selected={listingRoomType === val} onPress={() => setListingRoomType(listingRoomType === val ? '' : val)} />
                  ))}
                </View>
                <TextInput style={styles.input} placeholder="Address" placeholderTextColor={D.grayDim} value={listingAddress} onChangeText={setListingAddress} />
                <TextInput style={styles.input} placeholder="City" placeholderTextColor={D.grayDim} value={listingCity} onChangeText={setListingCity} />
                <TextInput style={styles.input} placeholder="State (e.g. CA)" placeholderTextColor={D.grayDim} value={listingStateVal} onChangeText={setListingStateVal} autoCapitalize="characters" maxLength={2} />
                <TextInput style={styles.input} placeholder="ZIP code" placeholderTextColor={D.grayDim} value={listingZip} onChangeText={setListingZip} keyboardType="numeric" maxLength={5} />
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
                    <TouchableOpacity style={[styles.photoAdd, { width: PHOTO_THUMB, height: PHOTO_THUMB * 1.25 }]} onPress={pickListingPhoto}>
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

  // ── Render ────────────────────────────────────────────────────────────────────

  const isLastStep = step === TOTAL_STEPS - 1;
  const progress = step === 12
    ? (12 + (dbStep + 1) / DEALBREAKER_ITEMS.length) / TOTAL_STEPS
    : (step + 1) / TOTAL_STEPS;
  const StepIcon  = step === 12 ? null : STEPS[step].icon;
  const question  = step === 12 ? DEALBREAKER_ITEMS[dbStep].question : STEPS[step].question;
  const subtitle  = step === 12 ? `${dbStep + 1} of ${DEALBREAKER_ITEMS.length}` : STEPS[step].subtitle;
  const isScrollStep = step > 12;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} disabled={step === 0 || saving}>
            {step > 0 && <Text style={styles.backBtnText}>←</Text>}
          </TouchableOpacity>
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
            </View>
          </View>
        </View>

        {/* ── Question block — hidden in prompt answer mode ── */}
        {!(step === 14 && promptMode === 'answer') && (
          <View style={styles.questionBlock}>
            {StepIcon && <StepIcon size={52} color={D.lime} weight="duotone" />}
            <Text style={styles.stepQuestion}>{question}</Text>
            <Text style={styles.stepSubtitle}>{subtitle}</Text>
          </View>
        )}

        {/* ── Step content ── */}
        <View style={isScrollStep ? styles.scrollWrapper : styles.inputWrapper}>
          {renderStepContent()}
        </View>

        {/* ── Footer — hidden in prompt answer mode ── */}
        {!AUTO_ADVANCE_STEPS.has(step) && !(step === 14 && promptMode === 'answer') && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.nextBtn, (!canAdvance() || saving) && styles.nextBtnDisabled]}
              onPress={handleNext}
              disabled={!canAdvance() || saving}
            >
              {saving
                ? <ActivityIndicator color="#0F1A00" />
                : <Text style={styles.nextBtnText}>{isLastStep ? 'Finish' : 'Continue'}</Text>
              }
            </TouchableOpacity>
          </View>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Theme ────────────────────────────────────────────────────────────────────

const D = {
  bg:            '#1A1D2E',
  surface:       'rgba(255,255,255,0.06)',
  surfaceBorder: 'rgba(255,255,255,0.10)',
  inputBg:       'rgba(255,255,255,0.08)',
  inputBorder:   'rgba(255,255,255,0.15)',
  white:         '#FDFDFD',
  gray:          '#B0B0B8',
  grayDim:       '#6B7280',
  lime:          '#84CC16',
  limeDark:      '#65A30D',
  red:           '#F87171',
  orange:        '#FB923C',
  trackBg:       'rgba(255,255,255,0.10)',
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: D.bg },
  flex:  { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { fontSize: 22, color: D.white },
  progressWrap: { flex: 1 },
  progressTrack: {
    height: 4,
    backgroundColor: D.trackBg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: D.lime, borderRadius: 2 },
  stepCounter: { fontSize: 12, color: D.gray, fontWeight: '600', minWidth: 38, textAlign: 'right' },

  // Question block
  questionBlock: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 8,
  },
  stepEmoji: { fontSize: 48, marginBottom: 16 },
  stepQuestion: {
    fontSize: 30,
    fontWeight: '800',
    color: D.white,
    lineHeight: 36,
    marginBottom: 8,
  },
  stepSubtitle: { fontSize: 15, color: D.gray, lineHeight: 21 },

  // Content areas
  inputWrapper: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollWrapper: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollArea: { flex: 1 },

  // Single focused input (name, age)
  focusInput: { paddingTop: 8 },
  heroInput: {
    fontSize: 28,
    fontWeight: '700',
    color: D.white,
    borderBottomWidth: 2,
    borderBottomColor: D.lime,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },

  // Stacked inputs (location, budget)
  inputStack: { gap: 0 },
  input: {
    backgroundColor: D.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: D.inputBorder,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 17,
    color: D.white,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: D.gray,
    marginTop: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hint: { fontSize: 13, color: D.grayDim, lineHeight: 18, marginBottom: 12 },
  errorText: { fontSize: 13, color: D.red, marginBottom: 8 },

  // Chip area (full-width chips)
  chipArea: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: D.surfaceBorder,
    backgroundColor: D.surface,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: { backgroundColor: D.lime, borderColor: D.lime },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontSize: 15, color: D.gray },
  chipTextSelected: { color: '#0F1A00', fontWeight: '700' },

  // Scale (cleanliness)
  scaleArea: { paddingTop: 16 },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  scaleLabel: { fontSize: 13, color: D.gray },
  scaleChips: { flexDirection: 'row', gap: 12 },
  scaleChip: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: D.surfaceBorder,
    backgroundColor: D.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleChipSelected: { backgroundColor: D.lime, borderColor: D.lime },
  scaleChipText: { fontSize: 20, fontWeight: '700', color: D.gray },
  scaleChipTextSelected: { color: '#0F1A00' },

  // Yes/No rows (pets & smoking)
  yesNoArea: { gap: 20, paddingTop: 8 },
  yesNoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yesNoLabel: { fontSize: 17, color: D.white, fontWeight: '500' },
  yesNoChips: { flexDirection: 'row', gap: 10 },

  // Date picker
  dateBtn: {
    backgroundColor: D.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: D.inputBorder,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  dateBtnText: { fontSize: 18, color: D.white, fontWeight: '600' },
  dateBtnPlaceholder: { color: D.grayDim },
  datePickerWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  dateDoneBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: D.lime,
    borderRadius: 8,
    marginTop: 10,
  },
  dateDoneBtnText: { color: '#0F1A00', fontSize: 14, fontWeight: '700' },

  // Dealbreakers
  dbRow: { marginBottom: 18 },
  dbLabel: { fontSize: 15, color: D.white, fontWeight: '500', marginBottom: 8 },
  dbChips: { flexDirection: 'row', gap: 8 },
  dbChip: {
    flex: 1, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5, borderColor: D.surfaceBorder,
    backgroundColor: D.surface, alignItems: 'center',
  },
  dbChipHard: { backgroundColor: 'rgba(248,113,113,0.20)', borderColor: D.red },
  dbChipSoft: { backgroundColor: 'rgba(251,146,60,0.20)', borderColor: D.orange },
  dbChipNone: { backgroundColor: 'rgba(132,204,22,0.20)', borderColor: D.lime },
  dbChipText: { fontSize: 13, color: D.gray, fontWeight: '500' },
  dbChipTextSelected: { color: D.white, fontWeight: '700' },

  // Interests
  catBlock: { borderBottomWidth: 1, borderBottomColor: D.surfaceBorder },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  catLabel: { fontSize: 16, fontWeight: '600', color: D.white },
  catChevron: { fontSize: 12, color: D.lime },
  catContent: { paddingBottom: 10 },
  customInputRow: { marginTop: 4, marginBottom: 8 },
  customInput: {
    backgroundColor: D.inputBg, borderRadius: 10, borderWidth: 1,
    borderColor: D.inputBorder, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: D.white,
  },

  // Prompts
  promptCount: { fontSize: 13, color: D.lime, fontWeight: '600', marginBottom: 12 },
  promptBlock: { marginBottom: 8 },
  promptRow: {
    padding: 14, borderRadius: 12, borderWidth: 1.5,
    borderColor: D.surfaceBorder, backgroundColor: D.surface,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  promptRowSelected: { borderColor: D.lime, backgroundColor: 'rgba(132,204,22,0.08)' },
  promptRowDimmed: { opacity: 0.35 },
  promptText: { fontSize: 14, color: D.gray, flex: 1, lineHeight: 20 },
  promptTextSelected: { color: D.white, fontWeight: '500' },
  promptCheck: { fontSize: 16, color: D.lime, marginLeft: 8, fontWeight: '700' },
  promptInput: {
    backgroundColor: D.inputBg, borderRadius: 12, borderWidth: 1,
    borderColor: D.inputBorder, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: D.white, marginTop: 6, minHeight: 80, textAlignVertical: 'top',
  },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8, marginTop: 8 },
  photoThumb: { borderRadius: 14, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoRemove: {
    position: 'absolute', top: 6, right: 6, width: 26, height: 26,
    borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveText: { color: D.white, fontSize: 12, fontWeight: '700' },
  photoAdd: {
    borderRadius: 14, borderWidth: 2, borderColor: D.surfaceBorder,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    backgroundColor: D.surface,
  },
  photoAddIcon: { fontSize: 32, color: D.grayDim },
  photoAddLabel: { fontSize: 12, color: D.grayDim, marginTop: 4 },
  photoCount: { fontSize: 13, color: D.grayDim, textAlign: 'center', marginBottom: 8 },

  // Footer
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: D.surfaceBorder,
    backgroundColor: D.bg,
  },
  skipBtn: {
    flex: 1,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.surfaceBorder,
  },
  skipBtnText: { fontSize: 16, fontWeight: '600', color: D.gray },
  nextBtn: {
    flex: 2,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: D.lime,
    shadowColor: D.lime,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  nextBtnFlex: { flex: 1 },
  nextBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  nextBtnText: { fontSize: 16, fontWeight: '800', color: '#0F1A00' },

  // State picker trigger
  pickerBtn: {
    backgroundColor: D.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: D.inputBorder,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pickerBtnText: { fontSize: 17, color: D.white, fontWeight: '500' },
  pickerBtnPlaceholder: { fontSize: 17, color: D.grayDim },
  pickerChevron: { fontSize: 11, color: D.lime },

  // Disabled input
  inputDisabled: { opacity: 0.35 },

  // Modal bottom sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#252938',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: D.white },
  modalClose: { fontSize: 18, color: D.gray, paddingHorizontal: 4 },
  modalSearch: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: D.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: D.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: D.white,
  },

  // State list rows
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: D.surfaceBorder,
  },
  stateRowSelected: { backgroundColor: 'rgba(132,204,22,0.10)' },
  stateRowText: { fontSize: 16, color: D.gray },
  stateRowTextSelected: { color: D.lime, fontWeight: '700' },
  stateRowAbbr: { fontSize: 14, color: D.grayDim, fontWeight: '600' },

  // Dealbreaker card sub-flow
  dbCardArea: {
    flex: 1,
    paddingTop: 8,
    gap: 14,
  },
  dbDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dbDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dbDotActive: {
    backgroundColor: D.lime,
    width: 20,
    borderRadius: 4,
  },
  dbDotDone: {
    backgroundColor: 'rgba(132,204,22,0.40)',
  },
  dbCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: D.surface,
    borderWidth: 1.5,
    borderColor: D.surfaceBorder,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 16,
  },
  dbCardHard: {
    backgroundColor: 'rgba(248,113,113,0.15)',
    borderColor: D.red,
  },
  dbCardSoft: {
    backgroundColor: 'rgba(251,146,60,0.15)',
    borderColor: D.orange,
  },
  dbCardNone: {
    backgroundColor: 'rgba(132,204,22,0.15)',
    borderColor: D.lime,
  },
  dbCardEmoji: { fontSize: 32 },
  dbCardText: { flex: 1 },
  dbCardLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: D.white,
    marginBottom: 2,
  },
  dbCardLabelSelected: { color: D.white },
  dbCardSub: {
    fontSize: 13,
    color: D.gray,
  },

  // ── Prompt card sub-flow ──────────────────────────────────────────────────────

  // Browse mode
  pProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  pProgressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: D.trackBg,
  },
  pProgressDotDone: { backgroundColor: D.lime },
  pProgressText: { fontSize: 13, color: D.gray, fontWeight: '600', marginLeft: 4 },

  pCard: {
    flex: 1,
    backgroundColor: D.surface,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: D.surfaceBorder,
    padding: 28,
    justifyContent: 'center',
    marginBottom: 20,
  },
  pCardQuestion: {
    fontSize: 26,
    fontWeight: '800',
    color: D.white,
    lineHeight: 34,
  },
  pCardDoneBadge: {
    alignSelf: 'flex-start',
    marginTop: 16,
    backgroundColor: 'rgba(132,204,22,0.15)',
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pCardDoneBadgeText: { fontSize: 12, fontWeight: '700', color: D.lime },

  pActions: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 8,
  },
  pSkipBtn: {
    flex: 1,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.surfaceBorder,
  },
  pSkipBtnText: { fontSize: 16, fontWeight: '600', color: D.gray },
  pUseBtn: {
    flex: 2,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: D.lime,
    shadowColor: D.lime,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  pUseBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  pUseBtnText: { fontSize: 16, fontWeight: '800', color: '#0F1A00' },

  // Answer mode
  pAnswerHeader: {
    backgroundColor: D.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: D.lime,
    padding: 20,
    marginBottom: 24,
  },
  pAnswerQuestion: {
    fontSize: 20,
    fontWeight: '700',
    color: D.white,
    lineHeight: 28,
  },
  pSuggestLabel: { fontSize: 13, color: D.gray, fontWeight: '600', marginBottom: 10 },
  pSuggestList: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  pSuggestChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: D.surface,
    borderWidth: 1.5,
    borderColor: D.surfaceBorder,
  },
  pSuggestChipActive: { borderColor: D.lime, backgroundColor: 'rgba(132,204,22,0.10)' },
  pSuggestText: { fontSize: 14, color: D.gray, fontWeight: '500' },
  pSuggestTextActive: { color: D.lime },
  pDraftInput: {
    backgroundColor: D.inputBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: D.inputBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: D.white,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 6,
  },
  pCharCount: { fontSize: 12, color: D.grayDim, textAlign: 'right', marginBottom: 20 },
  pSaveBtn: {
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: D.lime,
    shadowColor: D.lime,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 24,
  },
  pSaveBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  pSaveBtnText: { fontSize: 16, fontWeight: '800', color: '#0F1A00' },
});
