/**
 * OnboardingScreen — 18-step focused onboarding flow.
 * One or two inputs per screen, Hinge-style.
 *
 *  0  Name
 *  1  Age
 *  2  Gender          (chips, auto-advance)
 *  3  Ethnicity       (chips, optional)
 *  4  Gender pref     (chips, auto-advance)
 *  5  Location        (city + state + zip)
 *  6  Budget          (min + max)
 *  7  Room type       (chips, auto-advance)
 *  8  Move-in date
 *  9  Cleanliness     (1–5 chips, auto-advance)
 * 10  Work schedule   (chips, auto-advance)
 * 11  Social vibe     (chips, auto-advance)
 * 12  Pets & Smoking  (2 yes/no rows)
 * 13  Dealbreakers
 * 14  Interests
 * 15  Prompts
 * 16  Photos
 * 17  Listing         (optional)
 */

import { useState, useEffect, useRef, lazy, Suspense, type ComponentType } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Easing,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
  Keyboard,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User, Cake, Sparkle, Globe, MapPin, CurrencyDollar,
  Door, CalendarBlank, Broom, Clock, UsersThree, PawPrint,
  ShieldWarning, Star, ChatCircleDots, Camera, House,
  Prohibit, MusicNote, Sun, Moon, Bed,
  XCircle, MinusCircle, CheckCircle,
} from 'phosphor-react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { fonts } from '../lib/typography';
import Slider from '@react-native-community/slider';
import { savePreferences } from '../lib/preferences';
import { uploadStagedPhotosAndMerge } from '../lib/profilePhotos';
import { uploadListingPhoto } from '../lib/storage';
import type { SearchAreaValue } from '../lib/searchAreaTypes';

const SearchAreaMapPicker = lazy(() => import('../components/SearchAreaMapPicker'));

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 18;

const GENDER_OPTIONS = ['Man', 'Woman', 'Non-binary', 'Trans man', 'Trans woman', 'Other'];

const ETHNICITY_OPTIONS = [
  'Black / African descent',
  'East Asian',
  'Hispanic / Latino',
  'Middle Eastern',
  'Native American',
  'Pacific Islander',
  'South Asian',
  'Southeast Asian',
  'White / Caucasian',
  'Other',
];

const DEALBREAKER_ITEMS = [
  { key: 'smoking',    question: 'Your roommate smokes indoors?' },
  { key: 'pets',       question: 'Your roommate has pets?' },
  { key: 'parties',    question: 'Your roommate throws frequent parties?' },
  { key: 'early_bird', question: 'Your roommate makes early morning noise?' },
  { key: 'night_owl',  question: 'Your roommate makes late night noise?' },
  { key: 'guests',     question: 'Your roommate has overnight guests regularly?' },
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
  {
    question: 'My ideal home temperature is…',
    suggestions: ['Freezing cold, always', 'Cool and comfortable', 'Warm and cozy', 'Depends on the season'],
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StepDef = { icon: ComponentType<any>; question: string; subtitle: string; optional?: boolean };

// Per-step display content
const STEPS: StepDef[] = [
  { icon: User,          question: "What's your name?",                subtitle: "This is how you'll appear to others." },
  { icon: Cake,          question: 'How old are you?',                 subtitle: 'You must be 18+ to use RoomPear.' },
  { icon: Sparkle,       question: 'How do you identify?',             subtitle: 'Helps personalize your matches.' },
  { icon: Globe,         question: 'A little more about you…',          subtitle: 'Both fields are optional — skip if you prefer.', optional: true },
  { icon: UsersThree,    question: 'Who would you like to live with?',  subtitle: 'Leave blank to see everyone.', optional: true },
  { icon: MapPin,        question: 'Where are you looking?',           subtitle: "We'll show you people in your area." },
  { icon: CurrencyDollar,question: "What's your monthly budget?",      subtitle: 'Your comfortable range for rent.' },
  { icon: Door,          question: 'What kind of room?',               subtitle: 'Pick what works for you.' },
  { icon: CalendarBlank, question: 'When do you want to move in?',     subtitle: 'Approximate is fine — you can update later.', optional: true },
  { icon: Broom,         question: 'How clean do you keep your space?', subtitle: '1 = relaxed about mess  ·  5 = spotless' },
  { icon: Clock,         question: "What's your work schedule?",       subtitle: 'Helps us find someone on your rhythm.' },
  { icon: UsersThree,    question: "What's your social vibe?",         subtitle: 'How often do you have people over?' },
  { icon: PawPrint,      question: 'About you…',                       subtitle: 'Helps us find compatible matches.' },
  { icon: ShieldWarning, question: 'Any dealbreakers?',                subtitle: 'Hard = never  ·  Soft = prefer not  ·  None = fine', optional: true },
  { icon: Star,          question: 'What are you into?',               subtitle: 'Select up to 5 per category.', optional: true },
  { icon: ChatCircleDots,question: 'In your own words…',               subtitle: 'Answer at least 2 prompts (up to 3).', optional: true },
  { icon: Camera,        question: 'Show yourself off',                subtitle: 'Your first photo is your first impression.' },
  { icon: House,         question: 'Got a place to offer?',            subtitle: 'Optional — skip if you are only looking.', optional: true },
];

// Steps that auto-advance when a chip is selected

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

  // Step 0: Name
  const [name, setName] = useState('');
  // Step 1: Age
  const [age, setAge] = useState('');
  // Step 2: Gender
  const [gender, setGender] = useState('');
  // Step 3: Ethnicity
  const [ethnicity, setEthnicity] = useState<string[]>([]);
  // Step 4: Gender preference + ethnicity preference
  const [genderPref, setGenderPref] = useState<string | null>(null);
  const [ethnicityPref, setEthnicityPref] = useState<string[]>([]);
  // Step 5: Location
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const useLegacyLocationUi = !Constants.expoConfig?.extra?.mapboxAccessToken || isExpoGo;
  const [city, setCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [searchArea, setSearchArea] = useState<SearchAreaValue | null>(null);
  // Step 6: Budget
  const [minBudget, setMinBudget] = useState(0);
  const [maxBudget, setMaxBudget] = useState(10000);
  // Step 7: Room type
  const [roomType, setRoomType] = useState('');
  // Step 8: Move-in date
  const [moveInDate, setMoveInDate] = useState<Date | null>(null);
  const [moveInOption, setMoveInOption] = useState<string>('');
  // Step 9: Cleanliness
  const [cleanliness, setCleanliness] = useState<number | null>(null);
  // Step 10: Work schedule
  const [workSchedule, setWorkSchedule] = useState<string[]>([]);
  // Step 11: Social vibe
  const [socialPref, setSocialPref] = useState('');
  // Step 12: Pets & Smoking
  const [petsAllowed, setPetsAllowed] = useState<boolean | null>(null);
  const [smokingAllowed, setSmokingAllowed] = useState<boolean | null>(null);
  // Step 13: Dealbreakers (sub-flow)
  const [dealbreakers, setDealbreakers] = useState<Record<string, DealbreakerLevel>>(
    Object.fromEntries(DEALBREAKER_ITEMS.map((d) => [d.key, 'none' as DealbreakerLevel]))
  );
  const [dbStep, setDbStep] = useState(0);
  const [dbSelected, setDbSelected] = useState<DealbreakerLevel | null>(null);
  const [dbIntroShown, setDbIntroShown] = useState(false);
  const dbCardAnim = useRef(new Animated.Value(1)).current;
  const logoBobAnim = useRef(new Animated.Value(0)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Step 14: Interests
  const [interests, setInterests] = useState<Record<string, string[]>>(
    Object.fromEntries(INTEREST_CATEGORIES.map((c) => [c.key, [] as string[]]))
  );
  const [activeCategory, setActiveCategory] = useState<string>('fitness');
  const [customInputs, setCustomInputs] = useState<Record<string, string>>(
    Object.fromEntries(INTEREST_CATEGORIES.map((c) => [c.key, '']))
  );
  // Step 15: Prompts
  const [promptAnswers, setPromptAnswers] = useState<PromptEntry[]>([]);
  const [promptDraft, setPromptDraft] = useState('');
  const [expandedPromptIdx, setExpandedPromptIdx] = useState<number | null>(null);
  const [promptPickerOpen, setPromptPickerOpen] = useState(false);
  const [activeSlotIdx, setActiveSlotIdx] = useState<0 | 1 | 2 | null>(null);
  // Step 16: Photos
  const [stagingUris, setStagingUris] = useState<string[]>([]);
  // Step 17: Listing
  const [hasListing, setHasListing] = useState(false);
  const [listingRent, setListingRent] = useState('');
  const [listingRoomType, setListingRoomType] = useState('');
  const [listingCity, setListingCity] = useState('');
  const [listingPhotos, setListingPhotos] = useState<string[]>([]);


  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
    return () => {
    };
  }, []);

  // ── Keyboard height tracking ─────────────────────────────────────────────────

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', e => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Logo bob animation (step 0) ─────────────────────────────────────────────

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoBobAnim, { toValue: -6, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(logoBobAnim, { toValue: 0,  duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [logoBobAnim]);

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
    if (ethnicity.length > 0) updates.ethnicity = ethnicity;
    if (Object.keys(updates).length === 0) return true;
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) console.warn('saveAboutYou', error.message);
    return !error;
  };

  const savePrompts = async (): Promise<void> => {
    if (!userId) return;
    const filtered = promptAnswers.filter((p): p is PromptEntry => p != null && !!p.answer.trim());
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
        const uploadedPaths: string[] = [];
        for (const uri of listingPhotos) {
          const { path } = await uploadListingPhoto(userId, uri);
          if (path) uploadedPaths.push(path);
        }
        await supabase.from('listings').insert({
          user_id: userId,
          rent: listingRent ? parseFloat(listingRent) : null,
          room_type: listingRoomType || null,
          city: listingCity || null,
          listing_photos: uploadedPaths,
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
        min_budget: minBudget,
        max_budget: maxBudget,
        room_type: (['private', 'shared', 'flexible', 'entire'] as const).includes(roomType as any)
          ? (roomType as 'private' | 'shared' | 'flexible' | 'entire') : undefined,
        move_in_date: moveInDate ? formatDateYMD(moveInDate) : undefined,
        pets_allowed: petsAllowed ?? undefined,
        smoking_allowed: smokingAllowed ?? undefined,
        cleanliness_level: cleanliness ?? undefined,
        work_schedule: workSchedule.length > 0 ? workSchedule.join(', ') : undefined,
        social_preference: socialPrefMapped as any,
        interests: Object.values(interests).some((v) => v.length > 0) ? interests : undefined,
        dealbreakers,
        gender_preference: (genderPref === null || genderPref === 'anyone') ? '' : genderPref,
        ethnicity_preference: ethnicityPref.length > 0 ? ethnicityPref : undefined,
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
    if (step === 13 && dbStep > 0) { setDbStep((s) => s - 1); setDbSelected(null); }
    else if (step === 13 && dbIntroShown) { setDbIntroShown(false); }
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
  };

  const handleNext = async () => {
    if (saving) return;
    if (step === TOTAL_STEPS - 1) { setSaving(true); await handleComplete(); return; }

    if (step === 13) {
      setDbSelected(null);
      if (dbStep < DEALBREAKER_ITEMS.length - 1) { setDbStep((s) => s + 1); return; }
      setDbStep(0);
      setStep((s) => s + 1);
      return;
    }

    setSaving(true);
    try {
      if (step === 3) {
        // End of about-you steps — save profile
        const ok = await saveAboutYou();
        if (!ok) { Alert.alert('Error', 'Could not save your info. Please try again.'); return; }
      } else if (step === 15) {
        await savePrompts();
      } else if (step === 16) {
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
    if (step === 1) return age.trim().length > 0 && parseInt(age, 10) >= 18;
    if (step === 13) return dbSelected !== null;
    if (step === 6) return minBudget <= maxBudget;
    if (step === 15) return promptAnswers.filter((p): p is PromptEntry => p != null && !!p.answer.trim()).length >= 2;
    if (step === 16) return stagingUris.length >= 2;
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
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled && result.assets[0]) setListingPhotos((p) => [...p, result.assets[0].uri].slice(0, 6));
  };


  // ── Prompt helpers ────────────────────────────────────────────────────────────

  const isPromptSelected = (q: string) => promptAnswers.some((p) => p.question === q);

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
                onPress={() => { setGender(g); }}
              />
            ))}
          </View>
        );

      // 3: Ethnicity (optional, auto-advance)
      case 3:
        return (
          <View style={styles.chipArea}>
            {ETHNICITY_OPTIONS.map((e) => (
              <Chip
                key={e}
                label={e}
                selected={ethnicity.includes(e)}
                onPress={() => setEthnicity(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e])}
              />
            ))}
          </View>
        );

      // 4: Gender preference (auto-advance)
      case 4:
        return (
          <View style={styles.chipArea}>
            {(['Man', 'Woman', 'Non-binary'] as const).map((g) => (
              <Chip
                key={g}
                label={g === 'Man' ? 'Men' : g === 'Woman' ? 'Women' : 'Non-binary'}
                selected={genderPref === g}
                onPress={() => { setGenderPref(genderPref === g ? '' : g); }}
              />
            ))}
            <Chip
              label="Anyone"
              selected={genderPref === ''}
              onPress={() => { setGenderPref(''); }}
            />
          </View>
        );

      // 5: Location
      case 5: {
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

      // 6: Budget
      case 6:
        return (
          <View style={styles.budgetSliderArea}>
            <View style={styles.budgetDisplay}>
              <View style={styles.budgetBadge}>
                <Text style={styles.budgetBadgeLabel}>Min</Text>
                <View style={styles.budgetInputRow}>
                  <Text style={styles.budgetDollar}>$</Text>
                  <Text style={styles.budgetBadgeValue}>{minBudget.toLocaleString()}</Text>
                </View>
              </View>
              <Text style={styles.budgetDash}>–</Text>
              <View style={styles.budgetBadge}>
                <Text style={styles.budgetBadgeLabel}>Max</Text>
                <View style={styles.budgetInputRow}>
                  {maxBudget >= 10000 ? (
                    <Text style={styles.budgetBadgeValue}>Unlimited</Text>
                  ) : (
                    <>
                      <Text style={styles.budgetDollar}>$</Text>
                      <Text style={styles.budgetBadgeValue}>{maxBudget.toLocaleString()}</Text>
                    </>
                  )}
                </View>
              </View>
            </View>
            <Text style={styles.budgetSliderLabel}>Minimum</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={10000}
              step={50}
              value={minBudget}
              onValueChange={(v) => setMinBudget(Math.min(v, maxBudget - 50))}
              minimumTrackTintColor={D.lime}
              maximumTrackTintColor="rgba(255,255,255,0.2)"
              thumbTintColor={D.lime}
            />
            <Text style={styles.budgetSliderLabel}>Maximum</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={10000}
              step={50}
              value={maxBudget}
              onValueChange={(v) => setMaxBudget(Math.max(v, minBudget + 50))}
              minimumTrackTintColor={D.lime}
              maximumTrackTintColor="rgba(255,255,255,0.2)"
              thumbTintColor={D.lime}
            />
            {maxBudget <= minBudget && (
              <Text style={styles.errorText}>Max must be greater than min</Text>
            )}
          </View>
        );

      // 7: Room type (auto-advance)
      case 7:
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
                onPress={() => { setRoomType(val); }}
              />
            ))}
          </View>
        );

      // 8: Move-in date
      case 8: {
        const moveInOptions = [
          { label: 'Immediately', months: 0 },
          { label: 'Within 2 weeks', months: 0.5 },
          { label: 'Within 1 month', months: 1 },
          { label: '1–3 months', months: 2 },
          { label: '3–6 months', months: 4 },
          { label: 'Flexible', months: -1 },
        ];
        return (
          <View style={styles.chipArea}>
            {moveInOptions.map(({ label, months }) => (
              <Chip
                key={label}
                label={label}
                selected={moveInOption === label}
                onPress={() => {
                  setMoveInOption(label);
                  if (months === -1) {
                    setMoveInDate(null);
                  } else {
                    const d = new Date();
                    d.setMonth(d.getMonth() + months);
                    d.setHours(0, 0, 0, 0);
                    setMoveInDate(d);
                  }
                  
                }}
              />
            ))}
          </View>
        );
      }

      // 9: Cleanliness (auto-advance)
      case 9:
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
                    
                  }}
                >
                  <Text style={[styles.scaleChipText, cleanliness === n && styles.scaleChipTextSelected]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      // 10: Work schedule (auto-advance)
      case 10:
        return (
          <View style={styles.chipArea}>
            {[
              { val: 'Student',   label: 'Student' },
              { val: '9-to-5',    label: '9 to 5' },
              { val: 'Remote',    label: 'Remote / WFH' },
              { val: 'Night Shift', label: 'Night Shift' },
              { val: 'Flexible',  label: 'Flexible' },
            ].map(({ val, label }) => (
              <Chip
                key={val}
                label={label}
                selected={workSchedule.includes(val)}
                onPress={() => setWorkSchedule(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val])}
              />
            ))}
          </View>
        );

      // 11: Social vibe (auto-advance)
      case 11:
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
                  
                }}
              />
            ))}
          </View>
        );

      // 12: Pets & Smoking
      case 12:
        return (
          <View style={styles.yesNoArea}>
            <View style={styles.yesNoRow}>
              <Text style={styles.yesNoLabel}>Do you have pets?</Text>
              <View style={styles.yesNoChips}>
                <Chip label="Yes" selected={petsAllowed === true}  onPress={() => setPetsAllowed(petsAllowed === true ? null : true)} />
                <Chip label="No"  selected={petsAllowed === false} onPress={() => setPetsAllowed(petsAllowed === false ? null : false)} />
              </View>
            </View>
            <View style={styles.yesNoRow}>
              <Text style={styles.yesNoLabel}>Do you smoke?</Text>
              <View style={styles.yesNoChips}>
                <Chip label="Yes" selected={smokingAllowed === true}  onPress={() => setSmokingAllowed(smokingAllowed === true ? null : true)} />
                <Chip label="No"  selected={smokingAllowed === false} onPress={() => setSmokingAllowed(smokingAllowed === false ? null : false)} />
              </View>
            </View>
          </View>
        );

      // 13: Dealbreakers (card sub-flow — one question at a time)
      case 13:
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
                    <Text style={[styles.dbCardSub, isSelected && { color: 'rgba(255,255,255,0.8)' }]}>{sublabel}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        );

      // 14: Interests
      case 14:
        return (
          <View style={{ flex: 1 }}>
            {/* ── Category chips (compact) ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 6, flexDirection: 'row' }}>
              {INTEREST_CATEGORIES.map(({ key, label }) => {
                const count = (interests[key] ?? []).length;
                const active = activeCategory === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setActiveCategory(key)}
                    activeOpacity={0.75}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: active ? '#1A2C24' : 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: active ? '#1A2C24' : 'rgba(26,44,36,0.15)' }}
                  >
                    <Text style={{ fontFamily: fonts.semiBold, fontSize: 13, color: active ? '#FFFFFF' : '#1A2C24' }}>
                      {label}{count > 0 ? ` · ${count}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── Chips for active category ── */}
            {INTEREST_CATEGORIES.filter(c => c.key === activeCategory).map(({ key, options }) => {
              const selected = interests[key] ?? [];
              return (
                <ScrollView key={key} style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}>
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
                  <TextInput
                    style={[styles.customInput, { marginTop: 8 }]}
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
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: D.grayDim, marginTop: 6 }}>
                    {selected.length} / 5 selected
                  </Text>
                </ScrollView>
              );
            })}
          </View>
        );

      // 15: Prompts — 3 slot cards
      case 15: {
        const SLOTS = [
          { idx: 0 as const, label: 'Prompt 1', required: true },
          { idx: 1 as const, label: 'Prompt 2', required: true },
          { idx: 2 as const, label: 'Prompt 3', required: false },
        ];
        const usedQuestions = promptAnswers.filter((a): a is PromptEntry => a != null).map(a => a.question);

        return (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 80 }}>
              {SLOTS.map(({ idx, label, required }) => {
                const entry = promptAnswers[idx];
                const isActive = expandedPromptIdx === idx;
                return (
                  <View key={idx} style={{ marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 16, borderWidth: 1.5, borderColor: entry ? 'rgba(45,106,79,0.3)' : 'rgba(255,255,255,0.5)', overflow: 'hidden' }}>
                    {/* Slot header */}
                    <TouchableOpacity
                      onPress={() => {
                        if (!entry) {
                          setActiveSlotIdx(idx);
                          setPromptPickerOpen(true);
                        } else {
                          setExpandedPromptIdx(isActive ? null : idx);
                          setPromptDraft(entry.answer);
                        }
                      }}
                      activeOpacity={0.75}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: entry ? '#2D6A4F' : 'rgba(26,44,36,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: entry ? '#FFFFFF' : 'rgba(26,44,36,0.4)' }}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        {entry ? (
                          <>
                            <Text style={{ fontFamily: fonts.semiBold, fontSize: 13, color: '#2D6A4F', marginBottom: 2 }}>{entry.question}</Text>
                            {!isActive && <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: D.gray }} numberOfLines={1}>{entry.answer || 'Tap to add your answer…'}</Text>}
                          </>
                        ) : (
                          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(26,44,36,0.4)' }}>
                            {required ? 'Choose a prompt…' : 'Optional — add a third prompt'}
                          </Text>
                        )}
                      </View>
                      {entry
                        ? <Text style={{ fontSize: 18, color: 'rgba(26,44,36,0.3)' }}>{isActive ? '▲' : '▼'}</Text>
                        : <Text style={{ fontSize: 20, color: 'rgba(26,44,36,0.25)' }}>＋</Text>
                      }
                    </TouchableOpacity>

                    {/* Inline answer editor */}
                    {isActive && entry && (
                      <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: 'rgba(45,106,79,0.1)' }}>
                        {/* Suggestions */}
                        {(() => {
                          const suggestions = PROMPTS.find(p => p.question === entry.question)?.suggestions ?? [];
                          return suggestions.length > 0 ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 12, paddingBottom: 4 }}>
                              {suggestions.map(s => (
                                <TouchableOpacity
                                  key={s}
                                  onPress={() => setPromptDraft(s)}
                                  activeOpacity={0.75}
                                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: promptDraft === s ? '#2D6A4F' : 'rgba(45,106,79,0.08)', borderWidth: 1, borderColor: promptDraft === s ? '#2D6A4F' : 'rgba(45,106,79,0.15)' }}
                                >
                                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: promptDraft === s ? '#FFFFFF' : '#2D6A4F' }}>{s}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          ) : null;
                        })()}
                        <TextInput
                          style={{ backgroundColor: 'rgba(45,106,79,0.05)', borderRadius: 10, padding: 12, fontSize: 14, color: D.white, fontFamily: fonts.regular, minHeight: 80, marginTop: 12, textAlignVertical: 'top' }}
                          placeholder="Write your answer…"
                          placeholderTextColor={D.grayDim}
                          value={promptDraft}
                          onChangeText={setPromptDraft}
                          multiline
                          maxLength={150}
                          autoFocus
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                          <TouchableOpacity onPress={() => {
                            setPromptAnswers(p => p.filter((_, i) => i !== idx));
                            setExpandedPromptIdx(null);
                            setPromptDraft('');
                          }}>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: D.red }}>Remove prompt</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ backgroundColor: promptDraft.trim() ? '#2D6A4F' : 'rgba(0,0,0,0.1)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}
                            disabled={!promptDraft.trim()}
                            onPress={() => {
                              setPromptAnswers(p => {
                                const updated = [...p];
                                updated[idx] = { question: entry.question, answer: promptDraft.trim() };
                                return updated;
                              });
                              setExpandedPromptIdx(null);
                              setPromptDraft('');
                            }}
                          >
                            <Text style={{ fontFamily: fonts.semiBold, fontSize: 13, color: promptDraft.trim() ? '#FFFFFF' : D.grayDim }}>Save</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Prompt picker modal */}
            <Modal visible={promptPickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPromptPickerOpen(false)}>
              <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#1A2C24' }}>Choose a prompt</Text>
                  <TouchableOpacity onPress={() => setPromptPickerOpen(false)}>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 16, color: D.gray }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
                  {PROMPTS.filter(p => !usedQuestions.includes(p.question)).map((p, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => {
                        if (activeSlotIdx === null) return;
                        setPromptAnswers(prev => {
                          const updated = [...prev];
                          updated[activeSlotIdx] = { question: p.question, answer: '' };
                          return updated;
                        });
                        setExpandedPromptIdx(activeSlotIdx);
                        setPromptDraft('');
                        setPromptPickerOpen(false);
                      }}
                      activeOpacity={0.75}
                      style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)' }}
                    >
                      <Text style={{ fontFamily: fonts.semiBold, fontSize: 15, color: '#1A2C24' }}>{p.question}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </Modal>
          </KeyboardAvoidingView>
        );
      }

      // 16: Photos
      case 16: {
        const SLOTS = [0, 1, 2, 3];
        const slotW = (Dimensions.get('window').width - 48 - 12) / 2;
        const slotH = Math.round(slotW * 5 / 4);
        return (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {SLOTS.map((i) => {
                const uri = stagingUris[i];
                return uri ? (
                  <View key={i} style={[styles.photoSlot, { width: slotW, height: slotH }]}>
                    <Image source={{ uri }} style={styles.photoSlotImg} />
                    <TouchableOpacity
                      style={styles.photoSlotRemove}
                      onPress={() => setStagingUris((p) => p.filter((_, j) => j !== i))}
                    >
                      <Text style={styles.photoSlotRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    key={i}
                    style={[styles.photoSlotEmpty, { width: slotW, height: slotH }]}
                    onPress={pickProfilePhoto}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.photoSlotPlus}>+</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.photoCount, { marginTop: 16 }]}>
              {stagingUris.length} / 4 photos{stagingUris.length < 2 ? ' — add at least 2' : ''}
            </Text>
          </View>
        );
      }

      // 17: Listing (optional)
      case 17:
        return (
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.chipRow}>
              <Chip label="Yes, I have a place to list" selected={hasListing} onPress={() => setHasListing(!hasListing)} />
            </View>
            {hasListing && (
              <View>
                <TextInput style={styles.input} placeholder="Monthly rent ($)" placeholderTextColor="rgba(26,44,36,0.45)" value={listingRent} onChangeText={setListingRent} keyboardType="numeric" />
                <TextInput style={styles.input} placeholder="City" placeholderTextColor="rgba(26,44,36,0.45)" value={listingCity} onChangeText={setListingCity} />
                <Text style={[styles.sectionLabel, { color: 'rgba(26,44,36,0.6)' }]}>Room type</Text>
                <View style={styles.chipRow}>
                  {[{ val: 'private', label: 'Private Room' }, { val: 'shared', label: 'Shared Room' }, { val: 'entire', label: 'Entire Place' }].map(({ val, label }) => (
                    <Chip key={val} label={label} selected={listingRoomType === val} onPress={() => setListingRoomType(listingRoomType === val ? '' : val)} />
                  ))}
                </View>
                <Text style={[styles.sectionLabel, { color: 'rgba(26,44,36,0.6)' }]}>Photos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {listingPhotos.map((uri, i) => (
                    <View key={i} style={styles.photoStripThumb}>
                      <Image source={{ uri }} style={styles.photoStripImg} />
                      <TouchableOpacity style={styles.photoStripRemove} onPress={() => setListingPhotos((p) => p.filter((_, j) => j !== i))}>
                        <Text style={styles.photoStripRemoveText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {listingPhotos.length < 6 && (
                    <TouchableOpacity style={styles.photoStripAdd} onPress={pickListingPhoto}>
                      <Text style={styles.photoAddIcon}>+</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
                <Text style={styles.photoCount}>{listingPhotos.length} / 6 photos{listingPhotos.length === 0 ? ' — optional but recommended' : ''}</Text>
              </View>
            )}
          </ScrollView>
        );

      default:
        return null;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const PHASE_LABEL =
    step <= 4  ? 'ABOUT YOU' :
    step <= 8  ? 'YOUR SPACE' :
    step <= 13 ? 'YOUR VIBE' :
                 'YOUR STORY';

  const progress = step === 13
    ? (13 + (dbStep + 1) / DEALBREAKER_ITEMS.length) / TOTAL_STEPS
    : (step + 1) / TOTAL_STEPS;
const question  = step === 13 ? DEALBREAKER_ITEMS[dbStep].question : STEPS[step].question;
  const subtitle  = step === 13 ? `${dbStep + 1} of ${DEALBREAKER_ITEMS.length}` : STEPS[step].subtitle;
  const isScrollStep = step > 13;

  // ── Step 13 intro — explain dealbreakers before the sub-flow ─────────────
  if (step === 13 && !dbIntroShown) {
    return (
      <View style={{ flex: 1, backgroundColor: '#A8C8A0' }}>
        <LinearGradient colors={['#A8C8A0', '#90B888', '#78A870']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#E8B84B', opacity: 0.15, top: -60, right: -60 }} />
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#4A7840', opacity: 0.12, bottom: 80, left: -60 }} />
        <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#D4A028', opacity: 0.10, top: '40%', right: 10 }} />

        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
          <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>

            <Animated.View style={{ alignItems: 'center', marginBottom: 32, transform: [{ translateY: logoBobAnim }] }}>
              <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 }}>
                <Image source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')} style={{ width: 56, height: 56 }} resizeMode="contain" />
              </View>
            </Animated.View>

            <Text style={{ fontFamily: fonts.extraBold, fontSize: 30, color: '#0A2000', lineHeight: 36, letterSpacing: -0.5, marginBottom: 16 }}>
              Let's talk{'\n'}dealbreakers.
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 16, color: 'rgba(10,32,0,0.7)', lineHeight: 24, marginBottom: 32 }}>
              We'll ask you about 6 things that could make or break a living situation.
            </Text>

            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#C84040', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>✕</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#0A2000' }}>Never</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(10,32,0,0.6)' }}>They won't appear in your deck</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#E8A030', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>~</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#0A2000' }}>Prefer not</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(10,32,0,0.6)' }}>They rank lower in your deck</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#2D6A4F', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>✓</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#0A2000' }}>Fine with it</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(10,32,0,0.6)' }}>No effect on your matches</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[s0.continueBtn, { backgroundColor: '#1E4A18', position: 'absolute', right: 24, bottom: keyboardHeight + 24 }]}
            onPress={() => setDbIntroShown(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-forward" size={24} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── Step 0: Name — Lovable-style light layout ─────────────────────────────
  if (step === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#C8EAC0' }}>
        <LinearGradient
          colors={['#C8EAC0', '#D4EEB8', '#E2EC9A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Pear-colored ambient blobs */}
        <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#E8B84B', opacity: 0.15, top: -60, right: -60 }} />
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#D4A028', opacity: 0.12, bottom: 80, left: -60 }} />
        <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#F0C860', opacity: 0.10, bottom: 260, right: 20 }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <View style={{ flex: 1 }}>


              {/* ── Floating logo card ── */}
              {step > 0 && (
                <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 0 }}>
                  <TouchableOpacity onPress={handleBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color="#1A2C24" />
                  </TouchableOpacity>
                </View>
              )}
            <Animated.View style={[s0.logoWrap, { transform: [{ translateY: logoBobAnim }] }]}>
                <View style={s0.logoCard}>
                  <Image
                    source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')}
                    style={s0.logoImg}
                    resizeMode="contain"
                  />
                </View>
              </Animated.View>

              {/* ── Phase badge ── */}
              <View style={{ paddingHorizontal: 24, marginBottom: 16, marginTop: -16 }}>
                <View style={s0.stepBadge}>
                  <View style={s0.stepBadgeDot} />
                  <Text style={s0.stepBadgeText}>{PHASE_LABEL}</Text>
                </View>
              </View>

              {/* ── Heading + subtitle ── */}
              <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
                <Text style={s0.heading}>
                  {name.trim() ? `Hey,\n${name.trim()}!` : 'What should\nwe call you?'}
                </Text>
                <Text style={s0.subheading}>
                  Your name is what your future roommates will see.
                </Text>
              </View>

              {/* ── Input ── */}
              <View style={{ paddingHorizontal: 24 }}>
                <TextInput
                  style={s0.input}
                  placeholder="Your name"
                  placeholderTextColor="rgba(45,74,53,0.4)"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => canAdvance() && handleNext()}
                />
              </View>

            </View>
          </KeyboardAvoidingView>

        {/* ── Continue button — absolutely above keyboard, always visible ── */}
        <TouchableOpacity
          style={[s0.continueBtn, !name.trim() && s0.continueBtnDim, { position: 'absolute', right: 24, bottom: keyboardHeight + 24 }]}
          onPress={handleNext}
          disabled={!canAdvance() || saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Ionicons name="arrow-forward" size={24} color={name.trim() ? '#fff' : 'rgba(255,255,255,0.5)'} />
          }
        </TouchableOpacity>
      </SafeAreaView>
      </View>
    );
  }

  // ── Step 1: Age — warm peach/golden twist ────────────────────────────────
  if (step === 1) {
    const ageNum = parseInt(age, 10);
    const ageTooYoung = age.length > 0 && !isNaN(ageNum) && ageNum < 18;

    return (
      <View style={{ flex: 1, backgroundColor: '#FDE8C8' }}>
        <LinearGradient
          colors={['#FDE8C4', '#F8DCA8', '#F0D07A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Ambient blobs */}
        <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#E87040', opacity: 0.12, top: -60, right: -60 }} />
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#C85020', opacity: 0.10, bottom: 80, left: -60 }} />
        <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#F0A040', opacity: 0.10, bottom: 260, right: 20 }} />

        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{ flex: 1 }}>

              {/* ── Floating logo card ── */}
              {step > 0 && (
                <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 0 }}>
                  <TouchableOpacity onPress={handleBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color="#1A2C24" />
                  </TouchableOpacity>
                </View>
              )}
            <Animated.View style={[s0.logoWrap, { transform: [{ translateY: logoBobAnim }] }]}>
                <View style={s0.logoCard}>
                  <Image
                    source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')}
                    style={s0.logoImg}
                    resizeMode="contain"
                  />
                </View>
              </Animated.View>

              {/* ── Phase badge ── */}
              <View style={{ paddingHorizontal: 24, marginBottom: 16, marginTop: -16 }}>
                <View style={[s0.stepBadge, { backgroundColor: 'rgba(255,255,255,0.55)' }]}>
                  <View style={[s0.stepBadgeDot, { backgroundColor: '#C86020' }]} />
                  <Text style={[s0.stepBadgeText, { color: '#7A3810' }]}>{PHASE_LABEL}</Text>
                </View>
              </View>

              {/* ── Heading ── */}
              <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
                <Text style={[s0.heading, { color: '#3A1A08' }]}>How old{'\n'}are you?</Text>
                <Text style={[s0.subheading, { color: '#7A4820' }]}>You must be 18+ to use RoomPear.</Text>
              </View>

              {/* ── Input ── */}
              <View style={{ paddingHorizontal: 24 }}>
                {ageTooYoung && (
                  <Text style={{ fontFamily: fonts.semiBold, fontSize: 13, color: '#C83020', marginBottom: 6 }}>You must be 18 or older.</Text>
                )}
                <TextInput
                  style={[s0.input, { borderBottomColor: 'rgba(120,60,10,0.3)', color: '#3A1A08' }]}
                  placeholder="Your age"
                  placeholderTextColor="rgba(120,80,20,0.4)"
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

            </View>
          </KeyboardAvoidingView>

          {/* ── Continue button ── */}
          <TouchableOpacity
            style={[s0.continueBtn, { backgroundColor: '#C86020' }, !canAdvance() && { backgroundColor: 'rgba(200,96,32,0.4)' }, { position: 'absolute', right: 24, bottom: keyboardHeight + 24 }]}
            onPress={handleNext}
            disabled={!canAdvance() || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="arrow-forward" size={24} color={canAdvance() ? '#fff' : 'rgba(255,255,255,0.5)'} />
            }
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── Step 8: Move-in date — sun-ripened warm peach twist ──────────────────
  if (step === 8) {
    const moveInOptions = [
      { label: 'Immediately', months: 0 },
      { label: 'Within 2 weeks', months: 0.5 },
      { label: 'Within 1 month', months: 1 },
      { label: '1–3 months', months: 2 },
      { label: '3–6 months', months: 4 },
      { label: 'Flexible', months: -1 },
    ];
    return (
      <View style={{ flex: 1, backgroundColor: '#FAD8A8' }}>
        <LinearGradient
          colors={['#FAD8A8', '#F4C880', '#EEB858']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Blobs — top left + mid right + bottom center */}
        <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#8AC830', opacity: 0.12, top: -40, left: -40 }} />
        <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#D85830', opacity: 0.10, top: 180, right: -30 }} />
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#E8A030', opacity: 0.13, bottom: -40, right: 60 }} />

        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
          <View style={{ flex: 1 }}>
            {step > 0 && (
              <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 0 }}>
                <TouchableOpacity onPress={handleBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                  <Ionicons name="arrow-back" size={20} color="#1A2C24" />
                </TouchableOpacity>
              </View>
            )}
            <Animated.View style={[s0.logoWrap, { transform: [{ translateY: logoBobAnim }] }]}>
              <View style={s0.logoCard}>
                <Image source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')} style={s0.logoImg} resizeMode="contain" />
              </View>
            </Animated.View>

            <View style={{ paddingHorizontal: 24, marginBottom: 16, marginTop: -16 }}>
              <View style={[s0.stepBadge, { backgroundColor: 'rgba(255,255,255,0.55)' }]}>
                <View style={[s0.stepBadgeDot, { backgroundColor: '#B86010' }]} />
                <Text style={[s0.stepBadgeText, { color: '#7A3808' }]}>YOUR SPACE</Text>
              </View>
            </View>

            <View style={{ paddingHorizontal: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {moveInOptions.map(({ label, months }) => (
                <TouchableOpacity
                  key={label}
                  onPress={() => {
                    setMoveInOption(label);
                    if (months === -1) { setMoveInDate(null); }
                    else if (months === 0.5) { const d = new Date(); d.setDate(d.getDate() + 14); d.setHours(0,0,0,0); setMoveInDate(d); }
                    else { const d = new Date(); d.setMonth(d.getMonth() + months); d.setHours(0,0,0,0); setMoveInDate(d); }

                  }}
                  activeOpacity={0.75}
                  style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: moveInOption === label ? '#B86010' : 'rgba(255,255,255,0.70)', borderWidth: 1.5, borderColor: moveInOption === label ? '#B86010' : 'rgba(255,255,255,0.60)' }}
                >
                  <Text style={{ fontFamily: fonts.semiBold, fontSize: 15, color: moveInOption === label ? '#FFFFFF' : '#2A1400' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity
            style={[s0.continueBtn, { backgroundColor: '#B86010' }, { position: 'absolute', right: 24, bottom: keyboardHeight + 24 }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-forward" size={24} color="#fff" />}
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── Step 7: Room type — deep D'Anjou green twist ─────────────────────────
  if (step === 7) {
    const ROOM_OPTIONS = [
      { val: 'private',  label: 'Private Room' },
      { val: 'shared',   label: 'Shared Room' },
      { val: 'flexible', label: 'Either works' },
      { val: 'entire',   label: 'Entire Place' },
    ];
    return (
      <View style={{ flex: 1, backgroundColor: '#A8D898' }}>
        <LinearGradient
          colors={['#A8D898', '#B0D880', '#C4D858']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Blobs — bottom center + top right + mid left */}
        <View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: '#E8B84B', opacity: 0.15, bottom: -30, left: 40 }} />
        <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#D86848', opacity: 0.10, top: -40, right: -30 }} />
        <View style={{ position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: '#4A8020', opacity: 0.12, top: 220, left: -30 }} />

        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
          <View style={{ flex: 1 }}>
            {step > 0 && (
              <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 0 }}>
                <TouchableOpacity onPress={handleBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                  <Ionicons name="arrow-back" size={20} color="#1A2C24" />
                </TouchableOpacity>
              </View>
            )}
            <Animated.View style={[s0.logoWrap, { transform: [{ translateY: logoBobAnim }] }]}>
              <View style={s0.logoCard}>
                <Image source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')} style={s0.logoImg} resizeMode="contain" />
              </View>
            </Animated.View>

            <View style={{ paddingHorizontal: 24, marginBottom: 16, marginTop: -16 }}>
              <View style={[s0.stepBadge, { backgroundColor: 'rgba(255,255,255,0.55)' }]}>
                <View style={[s0.stepBadgeDot, { backgroundColor: '#2A5808' }]} />
                <Text style={[s0.stepBadgeText, { color: '#1A3804' }]}>{PHASE_LABEL}</Text>
              </View>
            </View>

            <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
              <Text style={[s0.heading, { color: '#0A2000' }]}>What space are{'\n'}you looking for?</Text>
              <Text style={[s0.subheading, { color: '#2A5010' }]}>Pick what works for you.</Text>
            </View>

            <View style={{ paddingHorizontal: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {ROOM_OPTIONS.map(({ val, label }) => (
                <TouchableOpacity
                  key={val}
                  onPress={() => { setRoomType(val); }}
                  activeOpacity={0.75}
                  style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: roomType === val ? '#2A5808' : 'rgba(255,255,255,0.70)', borderWidth: 1.5, borderColor: roomType === val ? '#2A5808' : 'rgba(255,255,255,0.60)' }}
                >
                  <Text style={{ fontFamily: fonts.semiBold, fontSize: 15, color: roomType === val ? '#FFFFFF' : '#0A2000' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity
            style={[s0.continueBtn, { backgroundColor: '#2A5808' }, { position: 'absolute', right: 24, bottom: keyboardHeight + 24 }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-forward" size={24} color="#fff" />}
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── Step 6: Budget — warm golden ripe pear twist ─────────────────────────
  if (step === 6) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8E8A0' }}>
        <LinearGradient
          colors={['#F8E8A0', '#F4DC78', '#EECE50']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Blobs — mid right + bottom left + top center */}
        <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#C86020', opacity: 0.10, top: 120, right: -60 }} />
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#6A9820', opacity: 0.12, bottom: -40, left: -40 }} />
        <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#E8A030', opacity: 0.13, top: -40, right: 60 }} />

        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
          <View style={{ flex: 1 }}>
            {step > 0 && (
              <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 0 }}>
                <TouchableOpacity onPress={handleBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                  <Ionicons name="arrow-back" size={20} color="#1A2C24" />
                </TouchableOpacity>
              </View>
            )}
            <Animated.View style={[s0.logoWrap, { transform: [{ translateY: logoBobAnim }] }]}>
              <View style={s0.logoCard}>
                <Image source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')} style={s0.logoImg} resizeMode="contain" />
              </View>
            </Animated.View>

            <View style={{ paddingHorizontal: 24, marginBottom: 16, marginTop: -16 }}>
              <View style={[s0.stepBadge, { backgroundColor: 'rgba(255,255,255,0.55)' }]}>
                <View style={[s0.stepBadgeDot, { backgroundColor: '#A86010' }]} />
                <Text style={[s0.stepBadgeText, { color: '#6A3808' }]}>{PHASE_LABEL}</Text>
              </View>
            </View>

            <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
              <Text style={[s0.heading, { color: '#2A1800' }]}>What's your{'\n'}monthly budget?</Text>
              <Text style={[s0.subheading, { color: '#6A4010' }]}>Your comfortable range for rent.</Text>
            </View>

            {/* Budget display */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 32, paddingHorizontal: 24 }}>
              <View style={{ alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20, flex: 1 }}>
                <Text style={{ fontFamily: fonts.semiBold, fontSize: 12, color: '#6A4010', marginBottom: 4 }}>Min</Text>
                <Text style={{ fontFamily: fonts.extraBold, fontSize: 26, color: '#2A1800' }}>${minBudget.toLocaleString()}</Text>
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#6A4010' }}>–</Text>
              <View style={{ alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20, flex: 1 }}>
                <Text style={{ fontFamily: fonts.semiBold, fontSize: 12, color: '#6A4010', marginBottom: 4 }}>Max</Text>
                <Text style={{ fontFamily: fonts.extraBold, fontSize: 26, color: '#2A1800' }}>{maxBudget >= 10000 ? 'No limit' : `$${maxBudget.toLocaleString()}`}</Text>
              </View>
            </View>

            <View style={{ paddingHorizontal: 24 }}>
              <Text style={{ fontFamily: fonts.semiBold, fontSize: 13, color: '#6A4010', marginBottom: 6 }}>Minimum</Text>
              <Slider style={styles.slider} minimumValue={0} maximumValue={10000} step={50} value={minBudget} onValueChange={(v) => setMinBudget(Math.min(v, maxBudget - 50))} minimumTrackTintColor="#A86010" maximumTrackTintColor="rgba(255,255,255,0.4)" thumbTintColor="#A86010" />
              <Text style={{ fontFamily: fonts.semiBold, fontSize: 13, color: '#6A4010', marginBottom: 6, marginTop: 12 }}>Maximum</Text>
              <Slider style={styles.slider} minimumValue={0} maximumValue={10000} step={50} value={maxBudget} onValueChange={(v) => setMaxBudget(Math.max(v, minBudget + 50))} minimumTrackTintColor="#A86010" maximumTrackTintColor="rgba(255,255,255,0.4)" thumbTintColor="#A86010" />
            </View>
          </View>

          <TouchableOpacity
            style={[s0.continueBtn, { backgroundColor: '#A86010' }, !canAdvance() && { backgroundColor: 'rgba(168,96,16,0.4)' }, { position: 'absolute', right: 24, bottom: keyboardHeight + 24 }]}
            onPress={handleNext}
            disabled={!canAdvance() || saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-forward" size={24} color={canAdvance() ? '#fff' : 'rgba(255,255,255,0.5)'} />}
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── Step 5: Location — cool mint-teal pear leaf twist ───────────────────
  if (step === 5) {
    const filteredStates = US_STATES.filter(
      (s) => s.label.toLowerCase().includes(stateSearch.toLowerCase()) || s.abbr.toLowerCase().includes(stateSearch.toLowerCase())
    );
    const selectedStateLabel = US_STATES.find((s) => s.abbr === locationState)?.label ?? '';

    return (
      <View style={{ flex: 1, backgroundColor: '#C0E8D8' }}>
        <LinearGradient
          colors={['#C0E8D4', '#B4E4C4', '#C0E898']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Blobs — top left + bottom right + mid left */}
        <View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: '#E8B84B', opacity: 0.13, top: -40, left: -60 }} />
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#4A9060', opacity: 0.12, bottom: -40, right: -40 }} />
        <View style={{ position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: '#D4A028', opacity: 0.10, top: 280, left: 20 }} />

        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{ flex: 1 }}>
              {step > 0 && (
                <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 0 }}>
                  <TouchableOpacity onPress={handleBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color="#1A2C24" />
                  </TouchableOpacity>
                </View>
              )}
            <Animated.View style={[s0.logoWrap, { transform: [{ translateY: logoBobAnim }] }]}>
                <View style={s0.logoCard}>
                  <Image source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')} style={s0.logoImg} resizeMode="contain" />
                </View>
              </Animated.View>

              <View style={{ paddingHorizontal: 24, marginBottom: 16, marginTop: -16 }}>
                <View style={[s0.stepBadge, { backgroundColor: 'rgba(255,255,255,0.55)' }]}>
                  <View style={[s0.stepBadgeDot, { backgroundColor: '#2A7050' }]} />
                  <Text style={[s0.stepBadgeText, { color: '#1A4030' }]}>{PHASE_LABEL}</Text>
                </View>
              </View>

              <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
                <Text style={[s0.heading, { color: '#0A2818' }]}>Where are{'\n'}you looking?</Text>
                <Text style={[s0.subheading, { color: '#2A5840' }]}>We'll show you people in your area.</Text>
              </View>

              {/* Inputs */}
              <View style={{ paddingHorizontal: 24, gap: 12 }}>
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.60)', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  onPress={() => { setStateSearch(''); setShowStatePicker(true); }}
                >
                  <Text style={{ fontFamily: fonts.semiBold, fontSize: 15, color: locationState ? '#0A2818' : 'rgba(10,40,24,0.4)' }}>{selectedStateLabel || 'Select a state'}</Text>
                  <Text style={{ color: '#2A7050', fontSize: 11 }}>▼</Text>
                </TouchableOpacity>

                <TextInput
                  style={{ backgroundColor: locationState ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.60)', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: fonts.semiBold, color: '#0A2818' }}
                  placeholder={locationState ? `City in ${selectedStateLabel}` : 'City (choose state first)'}
                  placeholderTextColor="rgba(10,40,24,0.35)"
                  value={city}
                  onChangeText={setCity}
                  editable={!!locationState}
                  returnKeyType="next"
                />

                <TextInput
                  style={{ backgroundColor: locationState ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.60)', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: fonts.semiBold, color: '#0A2818' }}
                  placeholder="ZIP code (optional)"
                  placeholderTextColor="rgba(10,40,24,0.35)"
                  value={zipCode}
                  onChangeText={(t) => setZipCode(t.replace(/\D/g, '').slice(0, 5))}
                  keyboardType="number-pad"
                  editable={!!locationState}
                />
              </View>
            </View>
          </KeyboardAvoidingView>

          {/* State picker modal */}
          <Modal visible={showStatePicker} animationType="slide" transparent onRequestClose={() => setShowStatePicker(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select a state</Text>
                  <TouchableOpacity onPress={() => setShowStatePicker(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <TextInput style={styles.modalSearch} placeholder="Search…" placeholderTextColor={D.grayDim} value={stateSearch} onChangeText={setStateSearch} autoCorrect={false} />
                <FlatList
                  data={filteredStates}
                  keyExtractor={(s) => s.abbr}
                  renderItem={({ item: s }) => (
                    <TouchableOpacity
                      style={[styles.stateRow, locationState === s.abbr && styles.stateRowSelected]}
                      onPress={() => { setLocationState(s.abbr); setShowStatePicker(false); }}
                    >
                      <Text style={[styles.stateRowText, locationState === s.abbr && styles.stateRowTextSelected]}>{s.label}</Text>
                      <Text style={styles.stateRowAbbr}>{s.abbr}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          </Modal>

          {/* Continue button */}
          <TouchableOpacity
            style={[s0.continueBtn, { backgroundColor: '#2A7050' }, !canAdvance() && { backgroundColor: 'rgba(42,112,80,0.4)' }, { position: 'absolute', right: 24, bottom: keyboardHeight + 24 }]}
            onPress={handleNext}
            disabled={!canAdvance() || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="arrow-forward" size={24} color={canAdvance() ? '#fff' : 'rgba(255,255,255,0.5)'} />
            }
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── Step 4: Gender pref — warm ivory/pear flesh twist ───────────────────
  if (step === 4) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F0ECD0' }}>
        <LinearGradient
          colors={['#F4F0D4', '#EEE8BC', '#E2D888']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Blobs shifted — bottom right + top left + mid */}
        <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#7AAA30', opacity: 0.13, bottom: -50, right: -50 }} />
        <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#E8B84B', opacity: 0.15, top: 60, left: -50 }} />
        <View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#A8C030', opacity: 0.10, top: 200, right: 10 }} />

        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
          <View style={{ flex: 1 }}>
            {step > 0 && (
              <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 0 }}>
                <TouchableOpacity onPress={handleBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                  <Ionicons name="arrow-back" size={20} color="#1A2C24" />
                </TouchableOpacity>
              </View>
            )}
            <Animated.View style={[s0.logoWrap, { transform: [{ translateY: logoBobAnim }] }]}>
              <View style={s0.logoCard}>
                <Image source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')} style={s0.logoImg} resizeMode="contain" />
              </View>
            </Animated.View>

            <View style={{ paddingHorizontal: 24, marginBottom: 16, marginTop: -16 }}>
              <View style={[s0.stepBadge, { backgroundColor: 'rgba(255,255,255,0.55)' }]}>
                <View style={[s0.stepBadgeDot, { backgroundColor: '#6A8A10' }]} />
                <Text style={[s0.stepBadgeText, { color: '#3A5008' }]}>{PHASE_LABEL}</Text>
              </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              <View style={{ marginBottom: 24 }}>
                <Text style={[s0.heading, { color: '#2A2808' }]}>Who would you{'\n'}like to live with?</Text>
                <Text style={[s0.subheading, { color: '#6A6020' }]}>Leave blank to see everyone.</Text>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
                {(['Man', 'Woman', 'Non-binary', 'Anyone'] as const).map((g) => {
                  const label = g === 'Man' ? 'Men' : g === 'Woman' ? 'Women' : g;
                  const val = g === 'Anyone' ? 'anyone' : g;
                  const selected = g === 'Anyone' ? genderPref === 'anyone' : genderPref === val;
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() => { setGenderPref(val); }}
                      activeOpacity={0.75}
                      style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: selected ? '#4A6A10' : 'rgba(255,255,255,0.70)', borderWidth: 1.5, borderColor: selected ? '#4A6A10' : 'rgba(255,255,255,0.60)' }}
                    >
                      <Text style={{ fontFamily: fonts.semiBold, fontSize: 15, color: selected ? '#FFFFFF' : '#2A2808' }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s0.subheading, { color: '#2A2808', fontFamily: fonts.bold, marginBottom: 12 }]}>Any ethnicity preference?</Text>
              <Text style={[s0.subheading, { color: '#6A6020', marginBottom: 12, marginTop: -8 }]}>Optional — select all that apply.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {ETHNICITY_OPTIONS.map((e) => {
                  const selected = ethnicityPref.includes(e);
                  return (
                    <TouchableOpacity
                      key={e}
                      onPress={() => setEthnicityPref(prev => selected ? prev.filter(x => x !== e) : [...prev, e])}
                      activeOpacity={0.75}
                      style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: selected ? '#4A6A10' : 'rgba(255,255,255,0.70)', borderWidth: 1.5, borderColor: selected ? '#4A6A10' : 'rgba(255,255,255,0.60)' }}
                    >
                      <Text style={{ fontFamily: fonts.semiBold, fontSize: 15, color: selected ? '#FFFFFF' : '#2A2808' }}>{e}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
          <TouchableOpacity
            style={[s0.continueBtn, { backgroundColor: '#4A6A10' }, { position: 'absolute', right: 24, bottom: keyboardHeight + 24 }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-forward" size={24} color="#fff" />}
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── Step 3: Ethnicity — rose-blush pear twist ────────────────────────────
  if (step === 3) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8D8C8' }}>
        <LinearGradient
          colors={['#F8D8C4', '#F4C8A8', '#EEB880']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#D86848', opacity: 0.12, top: -60, right: -60 }} />
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#E8B84B', opacity: 0.14, bottom: 80, left: -60 }} />
        <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#C85040', opacity: 0.09, bottom: 260, right: 20 }} />

        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
          <View style={{ flex: 1 }}>
            {step > 0 && (
              <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 0 }}>
                <TouchableOpacity onPress={handleBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                  <Ionicons name="arrow-back" size={20} color="#1A2C24" />
                </TouchableOpacity>
              </View>
            )}
            <Animated.View style={[s0.logoWrap, { transform: [{ translateY: logoBobAnim }] }]}>
              <View style={s0.logoCard}>
                <Image source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')} style={s0.logoImg} resizeMode="contain" />
              </View>
            </Animated.View>

            <View style={{ paddingHorizontal: 24, marginBottom: 16, marginTop: -16 }}>
              <View style={[s0.stepBadge, { backgroundColor: 'rgba(255,255,255,0.55)' }]}>
                <View style={[s0.stepBadgeDot, { backgroundColor: '#A84020' }]} />
                <Text style={[s0.stepBadgeText, { color: '#7A2810' }]}>{PHASE_LABEL}</Text>
              </View>
            </View>

            <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
              <Text style={[s0.heading, { color: '#3A1008' }]}>A little more{'\n'}about you…</Text>
              <Text style={[s0.subheading, { color: '#7A4020' }]}>Optional — skip if you prefer.</Text>
            </View>

            <View style={{ paddingHorizontal: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {ETHNICITY_OPTIONS.map((e) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => setEthnicity(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e])}
                  activeOpacity={0.75}
                  style={{
                    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
                    backgroundColor: ethnicity.includes(e) ? '#A84020' : 'rgba(255,255,255,0.70)',
                    borderWidth: 1.5,
                    borderColor: ethnicity.includes(e) ? '#A84020' : 'rgba(255,255,255,0.60)',
                  }}
                >
                  <Text style={{ fontFamily: fonts.semiBold, fontSize: 15, color: ethnicity.includes(e) ? '#FFFFFF' : '#3A1008' }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity
            style={[s0.continueBtn, { backgroundColor: '#A84020' }, { position: 'absolute', right: 24, bottom: keyboardHeight + 24 }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-forward" size={24} color="#fff" />}
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── Step 2: Gender — lime-yellow pear twist ──────────────────────────────
  if (step === 2) {
    return (
      <View style={{ flex: 1, backgroundColor: '#D4EEA8' }}>
        <LinearGradient
          colors={['#D0EAA8', '#DCF09C', '#EAEE70']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Ambient blobs */}
        <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#E8B84B', opacity: 0.15, top: -60, right: -60 }} />
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#A8C830', opacity: 0.12, bottom: 80, left: -60 }} />
        <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#D4A028', opacity: 0.10, bottom: 260, right: 20 }} />

        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
          <View style={{ flex: 1 }}>

            {/* ── Floating logo card ── */}
            {step > 0 && (
              <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 0 }}>
                <TouchableOpacity onPress={handleBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                  <Ionicons name="arrow-back" size={20} color="#1A2C24" />
                </TouchableOpacity>
              </View>
            )}
            <Animated.View style={[s0.logoWrap, { transform: [{ translateY: logoBobAnim }] }]}>
              <View style={s0.logoCard}>
                <Image
                  source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')}
                  style={s0.logoImg}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>

            {/* ── Phase badge ── */}
            <View style={{ paddingHorizontal: 24, marginBottom: 16, marginTop: -16 }}>
              <View style={[s0.stepBadge, { backgroundColor: 'rgba(255,255,255,0.55)' }]}>
                <View style={[s0.stepBadgeDot, { backgroundColor: '#6A8A10' }]} />
                <Text style={[s0.stepBadgeText, { color: '#3A5008' }]}>{PHASE_LABEL}</Text>
              </View>
            </View>

            {/* ── Heading ── */}
            <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
              <Text style={[s0.heading, { color: '#1E3004' }]}>How do you{'\n'}identify?</Text>
              <Text style={[s0.subheading, { color: '#4A6010' }]}>Helps personalize your matches.</Text>
            </View>

            {/* ── Chips ── */}
            <View style={{ paddingHorizontal: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {GENDER_OPTIONS.map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => { setGender(g); }}
                  activeOpacity={0.75}
                  style={{
                    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
                    backgroundColor: gender === g ? '#3A5008' : 'rgba(255,255,255,0.70)',
                    borderWidth: 1.5,
                    borderColor: gender === g ? '#3A5008' : 'rgba(255,255,255,0.60)',
                  }}
                >
                  <Text style={{ fontFamily: fonts.semiBold, fontSize: 15, color: gender === g ? '#FFFFFF' : '#1E3004' }}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

          </View>
          <TouchableOpacity
            style={[s0.continueBtn, { backgroundColor: '#3A5008' }, { position: 'absolute', right: 24, bottom: keyboardHeight + 24 }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-forward" size={24} color="#fff" />}
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // Per-step pear palette (steps 9–17)
  const STEP_PALETTES: Record<number, { grad: [string, string, string]; blob1: string; blob2: string; blob3: string; accent: string }> = {
    9:  { grad: ['#D4A878','#C89860','#BC8848'], blob1: '#E8B84B', blob2: '#8A5020', blob3: '#D4A028', accent: '#7A4010' },
    10: { grad: ['#F4E8A0','#EED870','#E4C840'], blob1: '#E87040', blob2: '#2D6A4F', blob3: '#F0C860', accent: '#C87820' },
    11: { grad: ['#C8ECD8','#B0E4C8','#90D4A8'], blob1: '#E8B84B', blob2: '#2D6A4F', blob3: '#D4A028', accent: '#2D7A4F' },
    12: { grad: ['#F0D0D0','#E8C0B8','#DCA898'], blob1: '#E87040', blob2: '#E8B84B', blob3: '#C85040', accent: '#B84828' },
    13: { grad: ['#A8C8A0','#90B888','#78A870'], blob1: '#E8B84B', blob2: '#4A7840', blob3: '#D4A028', accent: '#1E4A18' },
    14: { grad: ['#F8F0A0','#F0E470','#E8D440'], blob1: '#E87040', blob2: '#2D6A4F', blob3: '#F0C860', accent: '#A87818' },
    15: { grad: ['#F8F0E0','#F0E4C8','#E8D4A8'], blob1: '#E8B84B', blob2: '#C87820', blob3: '#D4A028', accent: '#8A5A20' },
    16: { grad: ['#C87850','#B86040','#A84830'], blob1: '#E8B84B', blob2: '#6A2010', blob3: '#D4A028', accent: '#6A2010' },
    17: { grad: ['#D0E8C8','#C0D8B0','#A8C898'], blob1: '#E8B84B', blob2: '#2D6A4F', blob3: '#D4A028', accent: '#2D5A1E' },
  };
  const pal = STEP_PALETTES[step] ?? STEP_PALETTES[9];

  return (
    <View style={{ flex: 1, backgroundColor: pal.grad[0] }}>
      <LinearGradient
        colors={pal.grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient pear blobs */}
      <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: pal.blob1, opacity: 0.15, top: -60, right: -60 }} />
      <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: pal.blob2, opacity: 0.12, bottom: 80, left: -60 }} />
      <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75,  backgroundColor: pal.blob3, opacity: 0.10, top: '40%', right: 10 }} />

      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* ── Header: back button ── */}
          <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 }}>
            {step > 0 && (
              <TouchableOpacity onPress={handleBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={20} color="#1A2C24" />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Floating logo ── */}
          <Animated.View style={{ alignItems: 'center', marginBottom: 8, transform: [{ translateY: logoBobAnim }] }}>
            <View style={{ width: 68, height: 68, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 }}>
              <Image source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')} style={{ width: 48, height: 48 }} resizeMode="contain" />
            </View>
          </Animated.View>

          {/* ── Phase badge ── */}
          <View style={{ paddingHorizontal: 24, marginBottom: 10 }}>
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: pal.accent }} />
              <Text style={{ fontFamily: fonts.semiBold, fontSize: 11, color: pal.accent, letterSpacing: 1.2 }}>{PHASE_LABEL}</Text>
            </View>
          </View>

          {/* ── Question ── */}
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            <Text style={{ fontFamily: fonts.extraBold, fontSize: 28, color: '#1A2C24', lineHeight: 34, letterSpacing: -0.5 }}>{question}</Text>
            {!!subtitle && <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(26,44,36,0.6)', marginTop: 4 }}>{subtitle}</Text>}
          </View>

          {/* ── Step content ── */}
          <View style={isScrollStep ? styles.scrollWrapper : styles.inputWrapper}>
            {renderStepContent()}
          </View>

          {/* ── Arrow button ── */}
          <TouchableOpacity
            style={[s0.continueBtn, (!canAdvance() || saving) && s0.continueBtnDim, { backgroundColor: canAdvance() ? pal.accent : 'rgba(0,0,0,0.15)', position: 'absolute', right: 24, bottom: step === 15 ? 24 : keyboardHeight + 24, zIndex: 99 }]}
            onPress={handleNext}
            disabled={!canAdvance() || saving}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
            }
          </TouchableOpacity>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Theme — matches profile-design branch ────────────────────────────────────

const D = {
  bg:            'transparent',
  surface:       'rgba(255,255,255,0.82)',   // glass card
  section:       'rgba(255,255,255,0.55)',
  surfaceBorder: 'rgba(255,255,255,0.45)',
  inputBg:       'rgba(255,255,255,0.60)',
  inputBorder:   'rgba(0,0,0,0.06)',
  white:         '#1A2C24',                  // dark forest text (matches profile)
  gray:          '#717182',
  grayDim:       '#A0A0B0',
  lime:          '#030213',                  // near-black for buttons/accents
  limeDark:      '#000000',
  selectedBg:    '#030213',
  selectedBorder:'#030213',
  red:           '#D4183D',
  orange:        '#FF9500',
  trackBg:       'rgba(255,255,255,0.35)',
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#1A3329' },
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
  backBtnText: { fontSize: 22, color: 'rgba(255,255,255,0.90)' },
  progressWrap: { flex: 1 },
  progressTrack: {
    height: 5,
    backgroundColor: D.trackBg,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: D.lime, borderRadius: 3 },
  stepCounter: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600', minWidth: 38, textAlign: 'right' },

  // Floating logo (step 0)
  floatingLogo: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  floatingLogoImg: { width: 72, height: 72 },

  // Question block
  questionBlock: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 4,
  },
  stepEmoji: { fontSize: 48, marginBottom: 16 },
  stepQuestion: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 35,
    marginBottom: 6,
    marginTop: 14,
  },
  stepSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.72)', lineHeight: 22 },

  // Content areas
  inputWrapper: { flex: 1, paddingHorizontal: 24 },
  scrollWrapper: { flex: 1, paddingHorizontal: 24 },
  scrollArea: { flex: 1 },

  // Single focused input (name, age)
  focusInput: { paddingTop: 8 },
  heroInput: {
    fontSize: 26,
    fontWeight: '600',
    color: D.white,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(0,0,0,0.15)',
    paddingVertical: 12,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },

  // Stacked inputs (location, budget)
  inputStack: { gap: 0 },
  input: {
    backgroundColor: D.inputBg,
    borderRadius: 12,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: D.white,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: D.grayDim,
    marginTop: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  hint: { fontSize: 13, color: D.grayDim, lineHeight: 18, marginBottom: 12 },
  errorText: { fontSize: 13, color: D.red, marginBottom: 8 },

  // Chips
  chipArea: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: D.surface,
    marginRight: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  chipSelected: { backgroundColor: D.selectedBg, shadowOpacity: 0 },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 15, color: D.white },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '700' },

  // Scale (cleanliness)
  scaleArea: { paddingTop: 16 },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  scaleLabel: { fontSize: 13, color: D.gray },
  scaleChips: { flexDirection: 'row', gap: 10 },
  scaleChip: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: D.surfaceBorder,
    backgroundColor: D.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleChipSelected: { backgroundColor: D.selectedBg, borderColor: D.selectedBorder },
  scaleChipText: { fontSize: 20, fontWeight: '700', color: D.gray },
  scaleChipTextSelected: { color: '#FFFFFF' },

  // Yes/No rows (pets & smoking)
  yesNoArea: { gap: 20, paddingTop: 8 },
  yesNoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yesNoLabel: { fontSize: 17, color: D.white, fontWeight: '500' },
  yesNoChips: { flexDirection: 'row', gap: 10 },

  // Date picker
  dateBtn: {
    backgroundColor: D.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: D.surfaceBorder,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  dateBtnText: { fontSize: 18, color: D.white, fontWeight: '600' },
  dateBtnPlaceholder: { color: D.grayDim },
  datePickerWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: D.surface,
    borderWidth: 1.5,
    borderColor: D.surfaceBorder,
  },
  dateDoneBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: D.lime,
    borderRadius: 8,
    marginTop: 10,
  },
  dateDoneBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Dealbreakers (old chip style — unused in card flow but kept)
  dbRow: { marginBottom: 18 },
  dbLabel: { fontSize: 15, color: D.white, fontWeight: '500', marginBottom: 8 },
  dbChips: { flexDirection: 'row', gap: 8 },
  dbChip: {
    flex: 1, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5, borderColor: D.surfaceBorder,
    backgroundColor: D.surface, alignItems: 'center',
  },
  dbChipHard: { backgroundColor: '#FEF2F2', borderColor: D.red },
  dbChipSoft: { backgroundColor: '#FFF7ED', borderColor: D.orange },
  dbChipNone: { backgroundColor: D.selectedBg, borderColor: D.lime },
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
    backgroundColor: D.surface, borderRadius: 10, borderWidth: 1.5,
    borderColor: D.surfaceBorder, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: D.white,
  },

  // Prompts (legacy — kept for safety)
  promptCount: { fontSize: 13, color: D.lime, fontWeight: '600', marginBottom: 12 },
  promptBlock: { marginBottom: 8 },
  promptRow: {
    padding: 14, borderRadius: 14, borderWidth: 1.5,
    borderColor: D.surfaceBorder, backgroundColor: D.surface,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  promptRowSelected: { borderColor: D.selectedBorder, backgroundColor: D.selectedBg },
  promptRowDimmed: { opacity: 0.35 },
  promptText: { fontSize: 14, color: D.gray, flex: 1, lineHeight: 20 },
  promptTextSelected: { color: D.white, fontWeight: '500' },
  promptCheck: { fontSize: 16, color: D.lime, marginLeft: 8, fontWeight: '700' },
  promptInput: {
    backgroundColor: D.surface, borderRadius: 12, borderWidth: 1.5,
    borderColor: D.surfaceBorder, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: D.white, marginTop: 6, minHeight: 80, textAlignVertical: 'top',
  },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8, marginTop: 8 },
  photoThumb: { borderRadius: 14, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoRemove: {
    position: 'absolute', top: 6, right: 6, width: 26, height: 26,
    borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
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
  },
  skipBtn: {
    flex: 1,
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  skipBtnText: { fontSize: 16, fontWeight: '600', color: D.gray },
  nextBtn: {
    flex: 2,
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    backgroundColor: D.lime,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },
  nextBtnFlex: { flex: 1 },
  nextBtnDisabled: { opacity: 0.35, shadowOpacity: 0 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  // State picker trigger
  pickerBtn: {
    backgroundColor: D.inputBg,
    borderRadius: 12,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pickerBtnText: { fontSize: 16, color: D.white, fontWeight: '500' },
  pickerBtnPlaceholder: { fontSize: 16, color: D.grayDim },
  pickerChevron: { fontSize: 11, color: D.lime },

  // Disabled input
  inputDisabled: { opacity: 0.4 },

  // Modal bottom sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: 'rgba(242,242,247,0.97)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: D.surfaceBorder,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: D.white },
  modalClose: { fontSize: 18, color: D.grayDim, paddingHorizontal: 4 },
  modalSearch: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: D.inputBg,
    borderRadius: 12,
    borderWidth: 0,
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
  stateRowSelected: { backgroundColor: D.selectedBg },
  stateRowText: { fontSize: 16, color: D.white },
  stateRowTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  stateRowAbbr: { fontSize: 14, color: D.grayDim, fontWeight: '600' },

  // Dealbreaker card sub-flow
  dbCardArea: { flex: 1, paddingTop: 8, gap: 12 },
  dbDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 8 },
  dbDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.trackBg },
  dbDotActive: { backgroundColor: D.lime, width: 20, borderRadius: 4 },
  dbDotDone: { backgroundColor: D.selectedBorder },
  dbCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: D.surface,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  dbCardHard: { backgroundColor: '#C84040', borderColor: '#C84040', shadowOpacity: 0.2 },
  dbCardSoft: { backgroundColor: '#D4780A', borderColor: '#D4780A', shadowOpacity: 0.2 },
  dbCardNone: { backgroundColor: '#2D6A4F', borderColor: '#2D6A4F', shadowOpacity: 0.2 },
  dbCardEmoji: { fontSize: 32 },
  dbCardText: { flex: 1 },
  dbCardLabel: { fontSize: 17, fontWeight: '700', color: D.white, marginBottom: 2 },
  dbCardLabelSelected: { color: '#FFFFFF' },
  dbCardSub: { fontSize: 13, color: D.gray },

  // ── Prompt card sub-flow ──────────────────────────────────────────────────────

  pProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  pProgressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: D.trackBg },
  pProgressDotDone: { backgroundColor: D.lime },
  pProgressText: { fontSize: 13, color: D.gray, fontWeight: '600', marginLeft: 4 },

  pCard: {
    flex: 1,
    backgroundColor: D.surface,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.9)',
    padding: 28,
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  pCardQuestion: { fontSize: 24, fontWeight: '800', color: D.white, lineHeight: 32 },
  pCardDoneBadge: {
    alignSelf: 'flex-start',
    marginTop: 16,
    backgroundColor: D.selectedBg,
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pCardDoneBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  pActions: { flexDirection: 'row', gap: 12, paddingBottom: 8 },
  pSkipBtn: {
    flex: 1,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: D.surface,
    borderWidth: 1.5,
    borderColor: D.surfaceBorder,
  },
  pSkipBtnText: { fontSize: 16, fontWeight: '600', color: D.gray },
  pUseBtn: {
    flex: 2,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: D.lime,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  pUseBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  pUseBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  pAnswerHeader: {
    backgroundColor: D.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  pAnswerQuestion: { fontSize: 28, fontWeight: '700', color: '#1A2C24', lineHeight: 36, marginBottom: 20 },
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
  pSuggestChipActive: { borderColor: D.selectedBorder, backgroundColor: D.selectedBg },
  pSuggestText: { fontSize: 14, color: D.gray, fontWeight: '500' },
  pSuggestTextActive: { color: '#FFFFFF', fontWeight: '600' },
  pDraftInput: {
    backgroundColor: D.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: D.surfaceBorder,
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
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: D.lime,
  },
  pSaveBtnDisabled: { opacity: 0.4 },
  pSaveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // Browse-all link + modal
  pBrowseAllBtn: { alignItems: 'center', paddingVertical: 12 },
  pBrowseAllText: { fontSize: 14, color: D.gray, fontWeight: '500', textDecorationLine: 'underline' },
  pAllModalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  pAllModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: D.surfaceBorder,
  },
  pAllModalTitle: { fontSize: 18, fontWeight: '700', color: D.white },
  pAllModalClose: { fontSize: 15, color: D.gray, fontWeight: '600' },
  pAllModalList: {
    paddingBottom: 32,
  },
  pAllModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
  },
  pAllModalScroll: { flex: 1 },
  pAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  pAllRowSelected: { backgroundColor: 'rgba(3,2,19,0.04)' },
  pAllRowDisabled: { opacity: 0.35 },
  pAllRowText: { fontSize: 15, color: D.white, flex: 1 },
  pAllRowTextSelected: { fontWeight: '600' },
  pAllRowCheck: { marginLeft: 12 },
  pCounterText: { fontSize: 13, color: D.lime, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  pListItem: { backgroundColor: '#F0F4F0', borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
  pListItemAnswered: { backgroundColor: '#E6F5E6', borderWidth: 1, borderColor: D.lime },
  pListItemDimmed: { opacity: 0.35 },
  pListRow: { padding: 16 },
  pListQuestion: { fontSize: 15, fontWeight: '600', color: '#1A2C24', lineHeight: 22 },
  pListQuestionAnswered: { color: D.lime },
  pListAnswerPreview: { fontSize: 13, color: '#6B8F71', marginTop: 4 },
  pListExpanded: { paddingHorizontal: 16, paddingBottom: 16 },
  pListActionRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 10 },
  pListRemoveBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  pListRemoveBtnText: { fontSize: 13, color: D.red, fontWeight: '600' },
  pListSaveHint: { fontSize: 12, color: '#6B8F71', marginTop: 6, marginBottom: 2 },
  photoStrip: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 8 },
  photoStripThumb: { width: 64, height: 80, borderRadius: 10, overflow: 'hidden' },
  photoStripImg: { width: 64, height: 80 },
  photoStripRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  photoStripRemoveText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  photoStripAdd: { width: 64, height: 80, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  photoSlot: { width: '47%', aspectRatio: 4 / 5, borderRadius: 16, overflow: 'hidden' },
  photoSlotImg: { width: '100%', height: '100%' },
  photoSlotRemove: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  photoSlotRemoveText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  photoSlotEmpty: { width: '47%', aspectRatio: 4 / 5, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(26,44,36,0.2)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.4)' },
  photoSlotPlus: { fontSize: 32, color: 'rgba(26,44,36,0.25)', lineHeight: 36 },
  budgetSliderArea: { flex: 1, justifyContent: 'center', paddingHorizontal: 4 },
  budgetDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 36 },
  budgetBadge: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20 },
  budgetBadgeLabel: { fontSize: 12, color: '#4A6358', fontWeight: '600', marginBottom: 4 },
  budgetBadgeValue: { fontSize: 26, fontWeight: '800', color: '#1A3329', textAlign: 'center', minWidth: 80 },
  budgetDash: { fontSize: 22, color: '#4A6358', fontWeight: '300' },
  budgetSliderLabel: { fontSize: 13, color: '#4A6358', fontWeight: '600', marginBottom: 6, marginTop: 16 },
  budgetInputRow: { flexDirection: 'row', alignItems: 'center' },
  budgetDollar: { fontSize: 26, fontWeight: '800', color: '#1A3329' },
  slider: { width: '100%', height: 40 },
});

// ─── Step 0 styles (Lovable-match) ────────────────────────────────────────────
const s0 = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segments: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  segmentActive: {
    backgroundColor: '#3B6B44',
  },
  stepCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D4A35',
    minWidth: 32,
    textAlign: 'right',
  },

  logoWrap: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 28,
  },
  logoCard: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  logoImg: {
    width: 58,
    height: 58,
  },

  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  stepBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B6B44',
  },
  stepBadgeText: {
    fontSize: 11,
    fontFamily: fonts.extraBold,
    color: '#2D4A35',
    letterSpacing: 0.8,
  },

  heading: {
    fontSize: 38,
    fontFamily: fonts.extraBold,
    color: '#1A2C24',
    lineHeight: 40,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: '#4A6A58',
    lineHeight: 22,
  },

  input: {
    backgroundColor: 'transparent',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(45,74,53,0.35)',
    paddingHorizontal: 0,
    paddingVertical: 10,
    fontSize: 26,
    fontFamily: fonts.semiBold,
    color: '#1A2C24',
  },
  inputHint: {
    fontSize: 13,
    color: '#5A7A68',
    marginTop: 10,
    marginLeft: 4,
  },

  continueBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B6B44',
    shadowColor: '#1A3329',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  continueBtnDim: {
    backgroundColor: 'rgba(59,107,68,0.4)',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnText: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: '#FFFFFF',
  },
  continueBtnTextDim: {
    color: 'rgba(255,255,255,0.65)',
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#5A7A68',
    marginTop: 14,
  },
});
