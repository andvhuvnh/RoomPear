import { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Slider } from '@miblanchard/react-native-slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPreferences, savePreferences } from '../lib/preferences';
import { fonts } from '../lib/typography';

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

  // Pre-fetch on mount so data is ready before the modal first opens
  useEffect(() => {
    getPreferences(userId).then(applyPrefs);
  }, [userId]);

  // Silently refresh whenever modal re-opens (no spinner)
  useEffect(() => {
    if (!visible) return;
    getPreferences(userId).then(applyPrefs);
  }, [visible, userId]);

  const toggleEthnicity = (opt: string) =>
    setEthnicityPref((prev) =>
      prev.includes(opt) ? prev.filter((e) => e !== opt) : [...prev, opt]
    );

  const handleApply = () => {
    // Close instantly — save + refresh happen in the background
    onClose();
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <Text style={styles.title}>Filters</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

              {/* Gender preference */}
              <Text style={styles.sectionTitle}>I want to live with</Text>
              <View style={styles.chipsRow}>
                {GENDER_PREF_OPTIONS.map(({ val, label }) => {
                  const on = genderPref === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setGenderPref(on ? '' : val)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.sectionSub}>Leave blank to see everyone</Text>

              <View style={styles.divider} />

              {/* Has listing toggle */}
              <Text style={styles.sectionTitle}>Has a place listed</Text>
              <View style={styles.chipsRow}>
                {(['Yes', 'No preference'] as const).map((opt) => {
                  const on = opt === 'Yes' ? hasListingOnly : !hasListingOnly;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setHasListingOnly(opt === 'Yes')}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.divider} />

              {/* Budget range */}
              <Text style={styles.sectionTitle}>Monthly budget</Text>
              <View style={styles.rangeDisplay}>
                <View style={[styles.rangeBadge, (minBudget === 0 && maxBudget >= 10000) && { opacity: 0.3 }]}>
                  <Text style={styles.rangeBadgeLabel}>MIN</Text>
                  <Text style={styles.rangeBadgeValue}>${minBudget.toLocaleString()}</Text>
                </View>
                <View style={[styles.rangeDash, (minBudget === 0 && maxBudget >= 10000) && { opacity: 0.3 }]} />
                <View style={styles.rangeBadge}>
                  <Text style={styles.rangeBadgeLabel}>MAX</Text>
                  <Text style={styles.rangeBadgeValue}>{maxBudget >= 10000 ? '$10,000+' : `$${maxBudget.toLocaleString()}`}</Text>
                </View>
              </View>
              <Slider
                minimumValue={0}
                maximumValue={10000}
                step={50}
                value={[minBudget, maxBudget]}
                onValueChange={(v) => { const [lo, hi] = v as number[]; setMinBudget(lo); setMaxBudget(hi); }}
                minimumTrackTintColor="#1A1A2E"
                maximumTrackTintColor="#D8D8E0"
                thumbTintColor="#1A1A2E"
                trackStyle={styles.track}
                thumbStyle={styles.thumb}
              />

              <View style={styles.divider} />

              {/* Age range */}
              <Text style={styles.sectionTitle}>Age range</Text>
              <View style={styles.rangeDisplay}>
                <View style={styles.rangeBadge}>
                  <Text style={styles.rangeBadgeLabel}>MIN</Text>
                  <Text style={styles.rangeBadgeValue}>{minAge}</Text>
                </View>
                <View style={styles.rangeDash} />
                <View style={styles.rangeBadge}>
                  <Text style={styles.rangeBadgeLabel}>MAX</Text>
                  <Text style={styles.rangeBadgeValue}>{maxAge >= 50 ? '50+' : maxAge}</Text>
                </View>
              </View>
              <Slider
                minimumValue={18}
                maximumValue={50}
                step={1}
                value={[minAge, maxAge]}
                onValueChange={(v) => { const [lo, hi] = v as number[]; setMinAge(lo); setMaxAge(hi); }}
                minimumTrackTintColor="#1A1A2E"
                maximumTrackTintColor="#D8D8E0"
                thumbTintColor="#1A1A2E"
                trackStyle={styles.track}
                thumbStyle={styles.thumb}
              />

              <View style={styles.divider} />

              {/* Room type */}
              <Text style={styles.sectionTitle}>Room type</Text>
              <View style={styles.chipsRow}>
                {ROOM_TYPE_OPTIONS.map(({ val, label }) => {
                  const on = roomType === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setRoomType(on ? '' : val)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.divider} />

              {/* Move-in date */}
              <Text style={styles.sectionTitle}>Move-in date</Text>
              <View style={styles.chipsRow}>
                {MOVE_IN_OPTIONS.map(({ label }) => {
                  const on = moveIn === label;
                  return (
                    <TouchableOpacity
                      key={label}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setMoveIn(on ? '' : label)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.divider} />

              {/* Ethnicity preference */}
              <Text style={styles.sectionTitle}>Ethnicity preference</Text>
              <Text style={[styles.sectionSub, { marginTop: -6, marginBottom: 12 }]}>
                Matching profiles rank higher in your feed. Leave blank for no preference.
              </Text>
              <View style={styles.chipsRow}>
                {ETHNICITY_OPTIONS.map((opt) => {
                  const on = ethnicityPref.includes(opt);
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => toggleEthnicity(opt)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.divider} />

              {/* Advanced Filters */}
              <View style={styles.advancedHeader}>
                <Text style={styles.sectionTitle}>Advanced Filters</Text>
                {!isPremium && (
                  <View style={styles.plusBadge}>
                    <Text style={styles.plusBadgeText}>RoomPear+</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.sectionSub, { marginTop: -6, marginBottom: 12 }]}>Strictly exclude profiles that don't meet these criteria.</Text>

              <View style={[styles.advancedControls, !isPremium && styles.advancedControlsLocked]}>
                {[
                  { label: 'No pets',            value: strictPets,        set: setStrictPets },
                  { label: 'No smoking',          value: strictSmoking,     set: setStrictSmoking },
                  { label: 'No parties',          value: strictParties,     set: setStrictParties },
                  { label: 'Strict cleanliness',  value: strictCleanliness, set: setStrictCleanliness },
                  { label: 'No night owls',       value: strictEarlyBird,   set: setStrictEarlyBird },
                  { label: 'No early birds',      value: strictNightOwl,    set: setStrictNightOwl },
                ].map(({ label, value, set }) => (
                  <View key={label} style={styles.advancedRow}>
                    <Text style={styles.advancedRowLabel}>{label}</Text>
                    <Switch
                      value={value}
                      onValueChange={isPremium ? set : undefined}
                      disabled={!isPremium}
                      trackColor={{ false: '#D8D8E0', true: '#1A1A2E' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                ))}

                {!isPremium && (
                  <View style={styles.advancedOverlay}>
                    <Text style={styles.advancedOverlayText}>Upgrade to RoomPear+ to use advanced filters</Text>
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

          <TouchableOpacity
            style={styles.applyBtn}
            onPress={handleApply}
            activeOpacity={0.85}
          >
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8D8E0',
    alignSelf: 'center',
    marginBottom: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: '#1A1A2E',
  },
  clearBtn: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#A0A0B0',
  },
  content: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8E8EC',
    marginVertical: 22,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#1A1A2E',
    marginBottom: 10,
  },
  sectionSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#A0A0B0',
    lineHeight: 18,
    marginBottom: 0,
    marginTop: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#D8D8E0',
    backgroundColor: '#FFFFFF',
  },
  chipOn: {
    backgroundColor: '#1A1A2E',
    borderColor: '#1A1A2E',
  },
  chipText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#3A3A4A',
  },
  chipTextOn: {
    color: '#FFFFFF',
  },
  rangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 14,
  },
  rangeBadge: {
    flex: 1,
    backgroundColor: '#F2F2F5',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rangeBadgeLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#A0A0B0',
    letterSpacing: 1,
  },
  rangeBadgeValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: '#1A1A2E',
    marginTop: 2,
  },
  rangeDash: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#D8D8E0',
  },
  track: {
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1A1A2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
  },
  plusBadge: {
    backgroundColor: '#1A1A2E',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  plusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  advancedControls: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E8EC',
    overflow: 'hidden',
  },
  advancedControlsLocked: {
    opacity: 0.50,
  },
  advancedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8EC',
  },
  advancedRowLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#1A1A2E',
  },
  advancedOverlay: {
    padding: 14,
    alignItems: 'center',
  },
  advancedOverlayText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#A0A0B0',
    textAlign: 'center',
  },
  applyBtn: {
    marginTop: 10,
    backgroundColor: '#1A1A2E',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  applyBtnText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
