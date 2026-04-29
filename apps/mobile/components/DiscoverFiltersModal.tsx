import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPreferences, savePreferences } from '../lib/preferences';

const GENDER_PREF_OPTIONS = [
  { val: 'Man',        label: 'Men' },
  { val: 'Woman',      label: 'Women' },
  { val: 'Non-binary', label: 'Non-binary' },
];

const ETHNICITY_OPTIONS = [
  'Asian',
  'Black / African American',
  'Hispanic / Latino',
  'Middle Eastern',
  'Native American',
  'Pacific Islander',
  'White / Caucasian',
  'Multiracial',
];

const ROOM_TYPE_OPTIONS = [
  { val: 'private',  label: 'Private room' },
  { val: 'shared',   label: 'Shared room' },
  { val: 'entire',   label: 'Entire place' },
  { val: 'flexible', label: 'Flexible' },
];

const MOVE_IN_OPTIONS = [
  { val: 'ASAP',       label: 'ASAP' },
  { val: '1-3 months', label: '1–3 months' },
  { val: '3-6 months', label: '3–6 months' },
  { val: 'Flexible',   label: 'Flexible' },
];

const LEASE_OPTIONS = [
  { val: 1,  label: 'Month-to-month' },
  { val: 6,  label: '6 months' },
  { val: 12, label: '1 year' },
  { val: 0,  label: 'Flexible' },
];

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
  const [leaseDuration, setLeaseDuration] = useState<number | null>(null);
  const [genderPref, setGenderPref] = useState('');
  const [hasListingOnly, setHasListingOnly] = useState(false);
  const [minBudget, setMinBudget] = useState(0);
  const [maxBudget, setMaxBudget] = useState(10000);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(99);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getPreferences(userId).then((prefs) => {
      setEthnicityPref(prefs?.ethnicity_preference ?? []);
      setRoomType(prefs?.room_type ?? '');
      setMoveIn(prefs?.move_in_date ?? '');
      setLeaseDuration(prefs?.lease_duration_months ?? null);
      setGenderPref(prefs?.gender_preference ?? '');
      setHasListingOnly(prefs?.has_listing_only ?? false);
      setMinBudget(prefs?.min_budget ?? 0);
      setMaxBudget(prefs?.max_budget ?? 10000);
      setMinAge(prefs?.min_age ?? 18);
      setMaxAge(prefs?.max_age ?? 99);
      setLoading(false);
    });
  }, [visible, userId]);

  const toggleEthnicity = (opt: string) =>
    setEthnicityPref((prev) =>
      prev.includes(opt) ? prev.filter((e) => e !== opt) : [...prev, opt]
    );

  const handleApply = async () => {
    setSaving(true);
    try {
      await savePreferences(userId, {
        gender_preference: genderPref || '',
        ethnicity_preference: ethnicityPref,
        room_type: (roomType as any) || undefined,
        move_in_date: moveIn || undefined,
        lease_duration_months: leaseDuration ?? undefined,
        has_listing_only: hasListingOnly,
        min_budget: minBudget,
        max_budget: maxBudget,
        min_age: minAge,
        max_age: maxAge,
      });
      onApply();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setEthnicityPref([]);
    setRoomType('');
    setMoveIn('');
    setLeaseDuration(null);
    setGenderPref('');
    setHasListingOnly(false);
    setMinBudget(0);
    setMaxBudget(10000);
    setMinAge(18);
    setMaxAge(99);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <Text style={styles.title}>Discover Filters</Text>
            <TouchableOpacity onPress={handleClear}>
              <Text style={styles.clearBtn}>Clear all</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 40 }} color="#1A3329" />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

              {/* Gender preference */}
              <Text style={styles.sectionTitle}>I want to live with</Text>
              <View style={[styles.chipsRow, { marginBottom: 4 }]}>
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
              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <Text style={styles.sectionTitle}>Has a place listed</Text>
                  <Text style={styles.sectionSub}>Only show people who already have a place to offer</Text>
                </View>
                <Switch
                  value={hasListingOnly}
                  onValueChange={setHasListingOnly}
                  trackColor={{ false: '#D0D0D8', true: '#1A3329' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.divider} />

              {/* Budget range */}
              <Text style={styles.sectionTitle}>Monthly budget</Text>
              <View style={styles.budgetDisplay}>
                <View style={styles.budgetBadge}>
                  <Text style={styles.budgetBadgeLabel}>Min</Text>
                  <Text style={styles.budgetBadgeValue}>${minBudget.toLocaleString()}</Text>
                </View>
                <View style={styles.budgetDash} />
                <View style={styles.budgetBadge}>
                  <Text style={styles.budgetBadgeLabel}>Max</Text>
                  <Text style={styles.budgetBadgeValue}>{maxBudget >= 10000 ? 'Unlimited' : `$${maxBudget.toLocaleString()}`}</Text>
                </View>
              </View>
              <Text style={styles.sliderLabel}>Minimum</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={maxBudget}
                step={50}
                value={minBudget}
                onValueChange={(v) => setMinBudget(Math.min(v, maxBudget - 50))}
                minimumTrackTintColor="#1A3329"
                maximumTrackTintColor="#D0D8D4"
                thumbTintColor="#1A3329"
              />
              <Text style={styles.sliderLabel}>Maximum</Text>
              <Slider
                style={styles.slider}
                minimumValue={minBudget + 50}
                maximumValue={10000}
                step={50}
                value={maxBudget}
                onValueChange={(v) => setMaxBudget(Math.max(v, minBudget + 50))}
                minimumTrackTintColor="#1A3329"
                maximumTrackTintColor="#D0D8D4"
                thumbTintColor="#1A3329"
              />

              <View style={styles.divider} />

              {/* Age range */}
              <Text style={styles.sectionTitle}>Age range</Text>
              <View style={styles.budgetDisplay}>
                <View style={styles.budgetBadge}>
                  <Text style={styles.budgetBadgeLabel}>Min</Text>
                  <Text style={styles.budgetBadgeValue}>{minAge}</Text>
                </View>
                <View style={styles.budgetDash} />
                <View style={styles.budgetBadge}>
                  <Text style={styles.budgetBadgeLabel}>Max</Text>
                  <Text style={styles.budgetBadgeValue}>{maxAge >= 99 ? 'Any' : maxAge}</Text>
                </View>
              </View>
              <Text style={styles.sliderLabel}>Minimum age</Text>
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={maxAge - 1}
                step={1}
                value={minAge}
                onValueChange={(v) => setMinAge(Math.floor(v))}
                minimumTrackTintColor="#1A3329"
                maximumTrackTintColor="#D0D8D4"
                thumbTintColor="#1A3329"
              />
              <Text style={styles.sliderLabel}>Maximum age</Text>
              <Slider
                style={styles.slider}
                minimumValue={minAge + 1}
                maximumValue={99}
                step={1}
                value={maxAge}
                onValueChange={(v) => setMaxAge(Math.floor(v))}
                minimumTrackTintColor="#1A3329"
                maximumTrackTintColor="#D0D8D4"
                thumbTintColor="#1A3329"
              />

              <View style={styles.divider} />

              {/* Move-in date */}
              <Text style={styles.sectionTitle}>Move-in date</Text>
              <View style={styles.chipsRow}>
                {MOVE_IN_OPTIONS.map(({ val, label }) => {
                  const on = moveIn === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setMoveIn(on ? '' : val)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.divider} />

              {/* Lease duration */}
              <Text style={styles.sectionTitle}>Lease duration</Text>
              <View style={styles.chipsRow}>
                {LEASE_OPTIONS.map(({ val, label }) => {
                  const on = leaseDuration === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setLeaseDuration(on ? null : val)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

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

              {/* Ethnicity preference */}
              <Text style={styles.sectionTitle}>Ethnicity preference</Text>
              <Text style={styles.sectionSub}>
                Preferred roommate ethnicity — matching profiles rank higher. Leave blank for no preference.
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

              {/* Advanced Filters — premium only */}
              {isPremium ? (
                <View style={styles.advancedActive}>
                  <Text style={styles.advancedActiveTitle}>✓ Advanced Filters active</Text>
                  <Text style={styles.advancedActiveSub}>
                    Your hard dealbreakers (pets, smoking, parties, cleanliness, sleep schedule, social vibe) strictly exclude incompatible profiles. Manage dealbreakers in onboarding settings.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.advancedLocked}
                  onPress={onUpgrade}
                  activeOpacity={0.8}
                >
                  <View style={styles.advancedLockedHeader}>
                    <Text style={styles.advancedLockedTitle}>🔒 Advanced Filters</Text>
                    <View style={styles.plusBadge}>
                      <Text style={styles.plusBadgeText}>RoomPear+</Text>
                    </View>
                  </View>
                  <Text style={styles.advancedLockedSub}>
                    Convert soft preferences into hard filters — strictly exclude profiles with pets, smoking, parties, or incompatible cleanliness and schedules.
                  </Text>
                  <View style={styles.advancedUnlockBtn}>
                    <Text style={styles.advancedUnlockBtnText}>Unlock with RoomPear+</Text>
                  </View>
                </TouchableOpacity>
              )}

            </ScrollView>
          )}

          <TouchableOpacity
            style={styles.applyBtn}
            onPress={handleApply}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.applyBtnText}>Apply filters</Text>
            }
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
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A2C24',
  },
  clearBtn: {
    fontSize: 14,
    fontWeight: '600',
    color: '#717182',
  },
  content: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleLeft: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A2C24',
    marginBottom: 6,
  },
  sectionSub: {
    fontSize: 13,
    color: '#717182',
    lineHeight: 18,
    marginBottom: 12,
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
    borderColor: '#A0B4AC',
    backgroundColor: '#F0F5F2',
  },
  chipOn: {
    backgroundColor: '#1A3329',
    borderColor: '#1A3329',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A2C24',
  },
  chipTextOn: {
    color: '#FFFFFF',
  },
  budgetDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  budgetBadge: {
    flex: 1,
    backgroundColor: '#F0F5F2',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  budgetBadgeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#717182',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  budgetBadgeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2C24',
    marginTop: 2,
  },
  budgetDash: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#A0B4AC',
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#717182',
    marginBottom: 2,
  },
  slider: {
    width: '100%',
    height: 36,
    marginBottom: 4,
  },
  advancedActive: {
    backgroundColor: '#F0F5F2',
    borderRadius: 14,
    padding: 16,
  },
  advancedActiveTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3329',
    marginBottom: 6,
  },
  advancedActiveSub: {
    fontSize: 13,
    color: '#717182',
    lineHeight: 18,
  },
  advancedLocked: {
    backgroundColor: '#F8F8FC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    padding: 16,
  },
  advancedLockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  advancedLockedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A2C24',
  },
  plusBadge: {
    backgroundColor: '#030213',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  plusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  advancedLockedSub: {
    fontSize: 13,
    color: '#717182',
    lineHeight: 18,
    marginBottom: 14,
  },
  advancedUnlockBtn: {
    backgroundColor: '#030213',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  advancedUnlockBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  applyBtn: {
    marginTop: 8,
    backgroundColor: '#1A3329',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
