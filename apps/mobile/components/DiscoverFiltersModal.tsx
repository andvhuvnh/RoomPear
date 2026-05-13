import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Slider } from '@miblanchard/react-native-slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPreferences, savePreferences } from '../lib/preferences';
import { fonts } from '../lib/typography';

const SCREEN_WIDTH = Dimensions.get('window').width;

const GENDER_PREF_OPTIONS = [
  { val: 'Man',        label: 'Men' },
  { val: 'Woman',      label: 'Women' },
  { val: 'Non-binary', label: 'Non-binary' },
];

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

const ROOM_TYPE_OPTIONS = [
  { val: 'private',  label: 'Private room' },
  { val: 'shared',   label: 'Shared room' },
  { val: 'entire',   label: 'Entire place' },
  { val: 'flexible', label: 'Flexible' },
];

const MOVE_IN_OPTIONS = [
  { label: 'Immediately',    offsetDays: 0 },
  { label: 'Within 2 weeks', offsetDays: 14 },
  { label: 'Within 1 month', offsetDays: 30 },
  { label: '1–3 months',     offsetDays: 60 },
  { label: '3–6 months',     offsetDays: 120 },
  { label: 'Flexible',       offsetDays: -1 },
];

function moveInLabelToDate(label: string): string | null {
  const opt = MOVE_IN_OPTIONS.find(o => o.label === label);
  if (!opt || opt.offsetDays === -1) return null;
  const d = new Date();
  d.setDate(d.getDate() + opt.offsetDays);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function moveInDateToLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Flexible';
  const stored = new Date(dateStr).getTime();
  const now = Date.now();
  const diffDays = (stored - now) / 86_400_000;
  if (diffDays <= 1)   return 'Immediately';
  if (diffDays <= 21)  return 'Within 2 weeks';
  if (diffDays <= 45)  return 'Within 1 month';
  if (diffDays <= 90)  return '1–3 months';
  return '3–6 months';
}

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onApply: () => void;
  isPremium?: boolean;
  onUpgrade?: () => void;
}

export default function DiscoverFiltersModal({ visible, userId, onClose, onApply, isPremium = false, onUpgrade }: Props) {
  const insets = useSafeAreaInsets();
  const screenSlide = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const startSlideIn = () => {
    screenSlide.setValue(SCREEN_WIDTH);
    Animated.spring(screenSlide, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 140, mass: 1 }).start();
  };

  const handleClose = () => {
    Animated.timing(screenSlide, { toValue: SCREEN_WIDTH, duration: 320, useNativeDriver: true }).start(() => onClose());
  };

  const [ethnicityPref, setEthnicityPref] = useState<string[]>([]);
  const [roomType, setRoomType] = useState('');
  const [moveIn, setMoveIn] = useState('');
  const [genderPref, setGenderPref] = useState('');
  const [hasListingOnly, setHasListingOnly] = useState(false);
  const [minBudget, setMinBudget] = useState(0);
  const [maxBudget, setMaxBudget] = useState(10000);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(99);
  const [strictPets, setStrictPets] = useState(false);
  const [strictSmoking, setStrictSmoking] = useState(false);
  const [strictParties, setStrictParties] = useState(false);
  const [strictCleanliness, setStrictCleanliness] = useState(false);
  const [strictEarlyBird, setStrictEarlyBird] = useState(false);
  const [strictNightOwl, setStrictNightOwl] = useState(false);

  function applyPrefs(prefs: Awaited<ReturnType<typeof getPreferences>>) {
    setEthnicityPref(prefs?.ethnicity_preference ?? []);
    setRoomType(prefs?.room_type ?? '');
    setMoveIn(prefs?.move_in_date ? moveInDateToLabel(prefs.move_in_date) : '');
    setGenderPref(prefs?.gender_preference ?? '');
    setHasListingOnly(prefs?.has_listing_only ?? false);
    setMinBudget(prefs?.min_budget ?? 0);
    setMaxBudget(prefs?.max_budget ?? 10000);
    setMinAge(prefs?.min_age ?? 18);
    setMaxAge(prefs?.max_age ?? 50);
    const db = prefs?.discover_filter_dealbreakers ?? prefs?.dealbreakers ?? {};
    setStrictPets(db.pets === 'hard');
    setStrictSmoking(db.smoking === 'hard');
    setStrictParties(db.parties === 'hard');
    setStrictCleanliness(db.messy === 'hard');
    setStrictEarlyBird(db.early_bird === 'hard');
    setStrictNightOwl(db.night_owl === 'hard');
  }

  useEffect(() => {
    getPreferences(userId).then(applyPrefs);
  }, [userId]);

  useEffect(() => {
    if (!visible) return;
    getPreferences(userId).then(applyPrefs);
  }, [visible, userId]);

  const toggleEthnicity = (opt: string) =>
    setEthnicityPref((prev) =>
      prev.includes(opt) ? prev.filter((e) => e !== opt) : [...prev, opt]
    );

  const handleApply = () => {
    Animated.timing(screenSlide, { toValue: SCREEN_WIDTH, duration: 320, useNativeDriver: true }).start(() => onClose());
    const discover_filter_dealbreakers: Record<string, 'hard' | 'soft' | 'none'> = {};
    if (isPremium) {
      discover_filter_dealbreakers.pets       = strictPets        ? 'hard' : 'none';
      discover_filter_dealbreakers.smoking    = strictSmoking     ? 'hard' : 'none';
      discover_filter_dealbreakers.parties    = strictParties     ? 'hard' : 'none';
      discover_filter_dealbreakers.messy      = strictCleanliness ? 'hard' : 'none';
      discover_filter_dealbreakers.early_bird = strictEarlyBird   ? 'hard' : 'none';
      discover_filter_dealbreakers.night_owl  = strictNightOwl    ? 'hard' : 'none';
    }
    void savePreferences(userId, {
      gender_preference: genderPref || '',
      ethnicity_preference: ethnicityPref,
      room_type: (roomType as any) || undefined,
      move_in_date: moveIn ? (moveInLabelToDate(moveIn) ?? undefined) : undefined,
      has_listing_only: hasListingOnly,
      min_budget: minBudget,
      max_budget: maxBudget,
      min_age: minAge,
      max_age: maxAge,
      ...(isPremium ? { discover_filter_dealbreakers } : {}),
    }).then(() => onApply());
  };

  const handleClear = () => {
    setEthnicityPref([]);
    setRoomType('');
    setMoveIn('');
    setGenderPref('');
    setHasListingOnly(false);
    setMinBudget(0);
    setMaxBudget(10000);
    setMinAge(18);
    setMaxAge(50);
    setStrictPets(false);
    setStrictSmoking(false);
    setStrictParties(false);
    setStrictCleanliness(false);
    setStrictEarlyBird(false);
    setStrictNightOwl(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="overFullScreen"
      transparent
      onShow={startSlideIn}
      onRequestClose={handleClose}
    >
      <Animated.View style={[s.root, { transform: [{ translateX: screenSlide }] }]}>
        <LinearGradient
          colors={['#EDF5EA', '#F4F9F0', '#FAFDF7', '#FFFFFF']}
          locations={[0, 0.3, 0.65, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={handleClose} style={s.backCircle} hitSlop={10} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={22} color="#111111" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Filters</Text>
          <TouchableOpacity onPress={handleClear} hitSlop={12} activeOpacity={0.7}>
            <Text style={s.clearBtn}>Clear all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Gender preference */}
          <Text style={s.sectionLabel}>I WANT TO LIVE WITH</Text>
          <View style={s.card}>
            <View style={s.chipsRow}>
              {GENDER_PREF_OPTIONS.map(({ val, label }) => {
                const on = genderPref === val;
                return (
                  <TouchableOpacity key={val} style={[s.chip, on && s.chipOn]} onPress={() => setGenderPref(on ? '' : val)}>
                    <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={s.cardSub}>Leave blank to see everyone</Text>
          </View>

          {/* Has listing */}
          <Text style={s.sectionLabel}>HAS A PLACE LISTED</Text>
          <View style={s.card}>
            <View style={s.chipsRow}>
              {(['Yes', 'No preference'] as const).map((opt) => {
                const on = opt === 'Yes' ? hasListingOnly : !hasListingOnly;
                return (
                  <TouchableOpacity key={opt} style={[s.chip, on && s.chipOn]} onPress={() => setHasListingOnly(opt === 'Yes')}>
                    <Text style={[s.chipText, on && s.chipTextOn]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Budget */}
          <Text style={s.sectionLabel}>MONTHLY BUDGET</Text>
          <View style={s.card}>
            <Text style={s.rangeValue}>
              {minBudget === 0 && maxBudget >= 10000
                ? 'Any budget'
                : minBudget === 0
                ? `Up to $${maxBudget.toLocaleString()}`
                : maxBudget >= 10000
                ? `$${minBudget.toLocaleString()}+`
                : `$${minBudget.toLocaleString()} – $${maxBudget.toLocaleString()}`}
            </Text>
            <Slider
              minimumValue={0}
              maximumValue={10000}
              step={50}
              value={[minBudget, maxBudget]}
              onValueChange={(v) => { const [lo, hi] = v as number[]; setMinBudget(lo); setMaxBudget(hi); }}
              minimumTrackTintColor="#2D6A4F"
              maximumTrackTintColor="#D8D8E0"
              thumbTintColor="#111111"
              trackStyle={s.track}
              thumbStyle={s.thumb}
            />
          </View>

          {/* Age */}
          <Text style={s.sectionLabel}>AGE RANGE</Text>
          <View style={s.card}>
            <Text style={s.rangeValue}>
              {minAge === 18 && maxAge >= 50
                ? 'Any age'
                : maxAge >= 50
                ? `${minAge}+`
                : `${minAge} – ${maxAge}`}
            </Text>
            <Slider
              minimumValue={18}
              maximumValue={50}
              step={1}
              value={[minAge, maxAge]}
              onValueChange={(v) => { const [lo, hi] = v as number[]; setMinAge(lo); setMaxAge(hi); }}
              minimumTrackTintColor="#2D6A4F"
              maximumTrackTintColor="#D8D8E0"
              thumbTintColor="#111111"
              trackStyle={s.track}
              thumbStyle={s.thumb}
            />
          </View>

          {/* Room type */}
          <Text style={s.sectionLabel}>ROOM TYPE</Text>
          <View style={s.card}>
            <View style={s.chipsRow}>
              {ROOM_TYPE_OPTIONS.map(({ val, label }) => {
                const on = roomType === val;
                return (
                  <TouchableOpacity key={val} style={[s.chip, on && s.chipOn]} onPress={() => setRoomType(on ? '' : val)}>
                    <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Move-in date */}
          <Text style={s.sectionLabel}>MOVE-IN DATE</Text>
          <View style={s.card}>
            <View style={s.chipsRow}>
              {MOVE_IN_OPTIONS.map(({ label }) => {
                const on = moveIn === label;
                return (
                  <TouchableOpacity key={label} style={[s.chip, on && s.chipOn]} onPress={() => setMoveIn(on ? '' : label)}>
                    <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Ethnicity preference */}
          <Text style={s.sectionLabel}>ETHNICITY PREFERENCE</Text>
          <View style={s.card}>
            <Text style={s.cardSub}>Matching profiles rank higher in your feed. Leave blank for no preference.</Text>
            <View style={[s.chipsRow, { marginTop: 10 }]}>
              {ETHNICITY_OPTIONS.map((opt) => {
                const on = ethnicityPref.includes(opt);
                return (
                  <TouchableOpacity key={opt} style={[s.chip, on && s.chipOn]} onPress={() => toggleEthnicity(opt)}>
                    <Text style={[s.chipText, on && s.chipTextOn]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Advanced filters */}
          <View style={s.advancedHeader}>
            <Text style={[s.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>ADVANCED FILTERS</Text>
            {!isPremium && (
              <View style={s.plusBadge}>
                <Text style={s.plusBadgeText}>RoomPear+</Text>
              </View>
            )}
          </View>
          <Text style={s.advancedSub}>Strictly exclude profiles that don't meet these criteria.</Text>
          <View style={[s.advancedCard, !isPremium && s.advancedLocked]}>
            {[
              { label: 'No pets',            value: strictPets,        set: setStrictPets },
              { label: 'No smoking',          value: strictSmoking,     set: setStrictSmoking },
              { label: 'No parties',          value: strictParties,     set: setStrictParties },
              { label: 'Strict cleanliness',  value: strictCleanliness, set: setStrictCleanliness },
              { label: 'No night owls',       value: strictEarlyBird,   set: setStrictEarlyBird },
              { label: 'No early birds',      value: strictNightOwl,    set: setStrictNightOwl },
            ].map(({ label, value, set }, i, arr) => (
              <View key={label} style={[s.advancedRow, i < arr.length - 1 && s.advancedRowBorder]}>
                <Text style={s.advancedRowLabel}>{label}</Text>
                <Switch
                  value={value}
                  onValueChange={isPremium ? set : undefined}
                  disabled={!isPremium}
                  trackColor={{ false: '#D1D5DB', true: '#4A7C59' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
            {!isPremium && (
              <View style={s.advancedOverlay}>
                <Text style={s.advancedOverlayText}>Upgrade to RoomPear+ to use advanced filters</Text>
              </View>
            )}
            {!isPremium && (
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                onPress={() => { onClose(); onUpgrade?.(); }}
                activeOpacity={0.0}
              />
            )}
          </View>
        </ScrollView>

        {/* Apply button */}
        <View style={[s.applyWrap, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={s.applyBtn} onPress={handleApply} activeOpacity={0.85}>
            <Text style={s.applyBtnText}>Apply filters</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EDF5EA' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.80)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 20, color: '#111111', letterSpacing: -0.4 },
  clearBtn: { fontFamily: fonts.semiBold, fontSize: 14, color: '#7A9080' },

  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

  sectionLabel: {
    fontFamily: fonts.bold, fontSize: 11,
    color: '#111111', letterSpacing: 0.9,
    marginBottom: 8, marginTop: 20,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18, padding: 14, marginBottom: 4,
    borderWidth: 1, borderColor: 'rgba(45,106,79,0.13)',
    shadowColor: '#2D6A4F', shadowOpacity: 0.11,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 3,
  },
  cardSub: { fontFamily: fonts.regular, fontSize: 13, color: '#7A9080', marginTop: 8, lineHeight: 18 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 50, borderWidth: 1.5,
    borderColor: 'rgba(45,106,79,0.18)',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  chipOn: { backgroundColor: '#111111', borderColor: '#111111' },
  chipText: { fontFamily: fonts.semiBold, fontSize: 13, color: '#3A3A4A' },
  chipTextOn: { color: '#FFFFFF' },

  rangeValue: {
    fontFamily: fonts.semiBold, fontSize: 15, color: '#111111',
    textAlign: 'center', marginBottom: 12,
  },
  track: { height: 4, borderRadius: 2 },
  thumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#111111',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },

  advancedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  advancedSub: { fontFamily: fonts.regular, fontSize: 13, color: '#7A9080', marginBottom: 8, lineHeight: 18 },
  plusBadge: {
    backgroundColor: '#111111', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  plusBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: '#FFFFFF', letterSpacing: 0.3 },

  advancedCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18, marginBottom: 4, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(45,106,79,0.13)',
    shadowColor: '#2D6A4F', shadowOpacity: 0.11,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 3,
  },
  advancedLocked: { opacity: 0.50 },
  advancedRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  advancedRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(45,106,79,0.10)',
  },
  advancedRowLabel: { fontFamily: fonts.semiBold, fontSize: 14, color: '#111111' },
  advancedOverlay: { padding: 14, alignItems: 'center' },
  advancedOverlayText: { fontFamily: fonts.semiBold, fontSize: 13, color: '#7A9080', textAlign: 'center' },

  applyWrap: { paddingHorizontal: 20, paddingTop: 10 },
  applyBtn: {
    backgroundColor: '#111111', paddingVertical: 16,
    borderRadius: 18, alignItems: 'center',
  },
  applyBtnText: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' },
});
