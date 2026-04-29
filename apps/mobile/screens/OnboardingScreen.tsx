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
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import Slider from '@react-native-community/slider';
import { savePreferences } from '../lib/preferences';
import { uploadStagedPhotosAndMerge } from '../lib/profilePhotos';
import PublicProfileCard from '../components/PublicProfileCard';
import type { SearchAreaValue } from '../lib/searchAreaTypes';

const SearchAreaMapPicker = lazy(() => import('../components/SearchAreaMapPicker'));

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 17;

const GENDER_OPTIONS = ['Man', 'Woman', 'Non-binary', 'Trans man', 'Trans woman', 'Other', 'Prefer not to say'];

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
  { icon: Globe,         question: 'A little more about you…',         subtitle: 'Both fields are optional — skip if you prefer.', optional: true },
  { icon: MapPin,        question: 'Where are you looking?',          subtitle: "We'll show you people in your area." },
  { icon: CurrencyDollar,question: "What's your monthly budget?",     subtitle: 'Your comfortable range for rent.' },
  { icon: Door,          question: 'What kind of room?',              subtitle: 'Pick what works for you.' },
  { icon: CalendarBlank, question: 'When do you want to move in?',    subtitle: 'Approximate is fine — you can update later.', optional: true },
  { icon: Broom,         question: 'How clean do you keep your space?',subtitle: '1 = relaxed about mess  ·  5 = spotless' },
  { icon: Clock,         question: "What's your work schedule?",      subtitle: 'Helps us find someone on your rhythm.' },
  { icon: UsersThree,    question: "What's your social vibe?",        subtitle: 'How often do you have people over?' },
  { icon: PawPrint,      question: 'About you…',                      subtitle: 'Helps us find compatible matches.' },
  { icon: ShieldWarning, question: 'Any dealbreakers?',               subtitle: 'Hard = never  ·  Soft = prefer not  ·  None = fine', optional: true },
  { icon: Star,          question: 'What are you into?',              subtitle: 'Select up to 5 per category.', optional: true },
  { icon: ChatCircleDots,question: 'In your own words…',              subtitle: 'Answer at least 2 prompts (up to 3).', optional: true },
  { icon: Camera,        question: 'Show yourself off',               subtitle: 'Your first photo is your first impression.' },
  { icon: House,         question: 'Got a place to offer?',           subtitle: 'Optional — skip if you are only looking.', optional: true },
];

// Steps that auto-advance when a chip is selected
const AUTO_ADVANCE_STEPS = new Set([2, 3, 6, 7, 8, 9, 10, 12]);

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

interface Props {
  onComplete: () => void;
  /** Sign out and return to login (e.g. OAuth landed user without prefs yet). */
  onLeaveToLogin?: () => void | Promise<void>;
}

export default function OnboardingScreen({ onComplete, onLeaveToLogin }: Props) {
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
  // Step 3: Ethnicity + gender preference
  const [ethnicity, setEthnicity] = useState('');
  const [genderPref, setGenderPref] = useState('');
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
  const [minBudget, setMinBudget] = useState(0);
  const [maxBudget, setMaxBudget] = useState(2000);
  // Step 6: Room type
  const [roomType, setRoomType] = useState('');
  // Step 7: Move-in date
  const [moveInDate, setMoveInDate] = useState<Date | null>(null);
  const [moveInOption, setMoveInOption] = useState<string>('');
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
  // Step 14: Prompts
  const [promptAnswers, setPromptAnswers] = useState<PromptEntry[]>([]);
  const [promptDraft, setPromptDraft] = useState('');
  const [expandedPromptIdx, setExpandedPromptIdx] = useState<number | null>(null);
  // Step 15: Photos
  const [stagingUris, setStagingUris] = useState<string[]>([]);
  // Step 16: Listing
  const [hasListing, setHasListing] = useState(false);
  const [listingRent, setListingRent] = useState('');
  const [listingRoomType, setListingRoomType] = useState('');
  const [listingCity, setListingCity] = useState('');


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
        await supabase.from('listings').insert({
          user_id: userId,
          rent: listingRent ? parseFloat(listingRent) : null,
          room_type: listingRoomType || null,
          city: listingCity || null,
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
        work_schedule: workSchedule || undefined,
        social_preference: socialPrefMapped as any,
        interests: Object.values(interests).some((v) => v.length > 0) ? interests : undefined,
        dealbreakers,
        gender_preference: genderPref || '',
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
    if (step === 5) return minBudget <= maxBudget;
    if (step === 14) return promptAnswers.filter((p) => p.answer.trim()).length >= 2;
    if (step === 15) return stagingUris.length >= 2;
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


  // ── Prompt helpers ────────────────────────────────────────────────────────────

  const isPromptSelected = (q: string) => promptAnswers.some((p) => p.question === q);

  const savePromptAnswer = (question: string) => {
    const answer = promptDraft.trim();
    if (!answer) return;
    setPromptAnswers((p) => {
      const exists = p.find((x) => x.question === question);
      if (exists) return p.map((x) => x.question === question ? { ...x, answer } : x);
      if (p.length >= 3) return p;
      return [...p, { question, answer }];
    });
    setPromptDraft('');
    setExpandedPromptIdx(null);
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
            <Text style={styles.sectionLabel}>Who would you like to live with?</Text>
            {(['Man', 'Woman', 'Non-binary'] as const).map((g) => (
              <Chip
                key={g}
                label={g === 'Man' ? 'Men' : g === 'Woman' ? 'Women' : 'Non-binary'}
                selected={genderPref === g}
                onPress={() => setGenderPref(genderPref === g ? '' : g)}
              />
            ))}
            <Chip
              label="Anyone"
              selected={genderPref === ''}
              onPress={() => setGenderPref('')}
            />
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
      case 5:
        return (
          <View style={styles.budgetSliderArea}>
            <View style={styles.budgetDisplay}>
              <View style={styles.budgetBadge}>
                <Text style={styles.budgetBadgeLabel}>Min</Text>
                <View style={styles.budgetInputRow}>
                  <Text style={styles.budgetDollar}>$</Text>
                  <TextInput
                    style={styles.budgetBadgeValue}
                    value={minBudget === 0 ? '' : String(minBudget)}
                    onChangeText={(t) => {
                      const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                      if (!isNaN(n)) setMinBudget(n);
                      else if (t === '') setMinBudget(0);
                    }}
                    onBlur={() => setMinBudget((v) => Math.min(v, maxBudget - 50))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#4A6358"
                    returnKeyType="done"
                  />
                </View>
              </View>
              <Text style={styles.budgetDash}>–</Text>
              <View style={styles.budgetBadge}>
                <Text style={styles.budgetBadgeLabel}>Max</Text>
                <View style={styles.budgetInputRow}>
                  <Text style={styles.budgetDollar}>$</Text>
                  <TextInput
                    style={styles.budgetBadgeValue}
                    value={String(maxBudget)}
                    onChangeText={(t) => {
                      const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                      if (!isNaN(n)) setMaxBudget(Math.min(n, 50000));
                    }}
                    onBlur={() => setMaxBudget((v) => Math.max(v, minBudget + 50))}
                    keyboardType="number-pad"
                    placeholder="2000"
                    placeholderTextColor="#4A6358"
                    returnKeyType="done"
                  />
                </View>
              </View>
            </View>
            <Text style={styles.budgetSliderLabel}>Minimum</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={50000}
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
              maximumValue={50000}
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
        const moveInOptions = [
          { label: 'ASAP', months: 0 },
          { label: '1 month', months: 1 },
          { label: '2 months', months: 2 },
          { label: '3 months', months: 3 },
          { label: '6 months', months: 6 },
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
                  scheduleAutoAdvance();
                }}
              />
            ))}
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

      // 14: Prompts (scrollable list)
      case 14: {
        const answered = promptAnswers.filter((p) => p.answer.trim()).length;
        const maxDone = answered >= 3;
        const counterText = answered === 0
          ? 'Answer at least 2 prompts'
          : answered === 1
          ? '1 answered — need 1 more'
          : answered === 2
          ? '2 answered — need 1 more or continue'
          : '3 / 3 — all done!';

        return (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.pCounterText}>{counterText}</Text>
              {PROMPTS.map((p, i) => {
                const selected = isPromptSelected(p.question);
                const existingAnswer = promptAnswers.find((a) => a.question === p.question)?.answer ?? '';
                const isExpanded = expandedPromptIdx === i;
                const dimmed = !selected && !isExpanded && maxDone;

                return (
                  <View key={i} style={[styles.pListItem, selected && styles.pListItemAnswered, dimmed && styles.pListItemDimmed]}>
                    <TouchableOpacity
                      style={styles.pListRow}
                      onPress={() => {
                        if (dimmed) return;
                        setExpandedPromptIdx(isExpanded ? null : i);
                        setPromptDraft(existingAnswer);
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.pListQuestion, selected && styles.pListQuestionAnswered]}>{p.question}</Text>
                      {selected && !isExpanded && (
                        <Text style={styles.pListAnswerPreview} numberOfLines={1}>{existingAnswer}</Text>
                      )}
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.pListExpanded}>
                        {/* Suggestions */}
                        <View style={styles.pSuggestList}>
                          {p.suggestions.map((s) => (
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
                        <TextInput
                          style={styles.pDraftInput}
                          placeholder="Write your own answer…"
                          placeholderTextColor={D.grayDim}
                          value={promptDraft}
                          onChangeText={setPromptDraft}
                          multiline
                          maxLength={150}
                          autoFocus
                        />
                        <Text style={styles.pListSaveHint}>{promptDraft.length} / 150 · Lock in your answer</Text>
                        <View style={styles.pListActionRow}>
                          {selected && (
                            <TouchableOpacity
                              style={styles.pListRemoveBtn}
                              onPress={() => {
                                setPromptAnswers((prev) => prev.filter((a) => a.question !== p.question));
                                setExpandedPromptIdx(null);
                                setPromptDraft('');
                              }}
                            >
                              <Text style={styles.pListRemoveBtnText}>Remove</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.pSaveBtn, !promptDraft.trim() && styles.pSaveBtnDisabled]}
                            onPress={() => savePromptAnswer(p.question)}
                            disabled={!promptDraft.trim()}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.pSaveBtnText}>Save</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </KeyboardAvoidingView>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
              {stagingUris.map((uri, i) => (
                <View key={i} style={styles.photoStripThumb}>
                  <Image source={{ uri }} style={styles.photoStripImg} />
                  <TouchableOpacity style={styles.photoStripRemove} onPress={() => setStagingUris((p) => p.filter((_, idx) => idx !== i))}>
                    <Text style={styles.photoStripRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {stagingUris.length < 4 && (
                <TouchableOpacity style={styles.photoStripAdd} onPress={pickProfilePhoto}>
                  <Text style={styles.photoAddIcon}>+</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            <Text style={styles.photoCount}>{stagingUris.length} / 4 photos added{stagingUris.length < 2 ? ' — add at least 2' : ''}</Text>
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
                <TextInput style={styles.input} placeholder="City" placeholderTextColor={D.grayDim} value={listingCity} onChangeText={setListingCity} />
                <Text style={styles.sectionLabel}>Room type</Text>
                <View style={styles.chipRow}>
                  {[{ val: 'private', label: 'Private Room' }, { val: 'shared', label: 'Shared Room' }, { val: 'entire', label: 'Entire Place' }].map(({ val, label }) => (
                    <Chip key={val} label={label} selected={listingRoomType === val} onPress={() => setListingRoomType(listingRoomType === val ? '' : val)} />
                  ))}
                </View>
                <Text style={styles.hint}>You can add your full address later.</Text>
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

  const handleLeaveToLogin = useCallback(() => {
    if (!onLeaveToLogin) return;
    Alert.alert(
      'Log out?',
      'You can sign in again anytime. Some answers may already be saved to your account.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => {
            void Promise.resolve(onLeaveToLogin()).catch(() => {
              Alert.alert('Could not log out', 'Please try again.');
            });
          },
        },
      ]
    );
  }, [onLeaveToLogin]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* ── Gradient + blur background (matches profile screen) ── */}
      <LinearGradient
        colors={['#1A3329', '#2D4F42', '#5A806B', '#9CB8A8', '#D8E8DF', '#F5FAF7', '#FFFFFF']}
        locations={[0, 0.06, 0.14, 0.28, 0.48, 0.72, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <BlurView
        intensity={Platform.OS === 'ios' ? 52 : 34}
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : 'light'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
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
          {onLeaveToLogin ? (
            <TouchableOpacity
              style={styles.headerLeaveBtn}
              onPress={handleLeaveToLogin}
              disabled={saving}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.headerLeaveText}>Log out</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerLeaveSpacer} />
          )}
        </View>

        {/* ── Question block — hidden in prompt answer mode ── */}
        <View style={[styles.questionBlock, step === 14 && { paddingBottom: 8 }]}>
          {StepIcon && <StepIcon size={52} color={D.lime} weight="duotone" />}
          <Text style={styles.stepQuestion}>{question}</Text>
          <Text style={styles.stepSubtitle}>{subtitle}</Text>
        </View>

        {/* ── Step content ── */}
        <View style={isScrollStep ? styles.scrollWrapper : styles.inputWrapper}>
          {renderStepContent()}
        </View>

        {/* ── Footer — hidden in prompt answer mode ── */}
        {!AUTO_ADVANCE_STEPS.has(step) && (
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
  headerLeaveBtn: {
    minWidth: 56,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  headerLeaveText: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.88)' },
  headerLeaveSpacer: { width: 56, height: 36 },
  progressWrap: { flex: 1 },
  progressTrack: {
    height: 5,
    backgroundColor: D.trackBg,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: D.lime, borderRadius: 3 },
  stepCounter: { fontSize: 12, color: D.gray, fontWeight: '600', minWidth: 38, textAlign: 'right' },

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
    borderWidth: 0,
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
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: D.inputBg,
    borderWidth: 0,
  },
  skipBtnText: { fontSize: 16, fontWeight: '600', color: D.gray },
  nextBtn: {
    flex: 2,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: D.lime,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
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
  dbCardHard: { backgroundColor: '#FEF2F2', borderColor: D.red },
  dbCardSoft: { backgroundColor: '#FFF7ED', borderColor: D.orange },
  dbCardNone: { backgroundColor: '#F9FAFB', borderColor: '#9CA3AF' },
  dbCardEmoji: { fontSize: 32 },
  dbCardText: { flex: 1 },
  dbCardLabel: { fontSize: 17, fontWeight: '700', color: D.white, marginBottom: 2 },
  dbCardLabelSelected: { color: D.white },
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
