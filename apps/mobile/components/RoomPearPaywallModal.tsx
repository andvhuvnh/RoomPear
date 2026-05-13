import { useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../lib/typography';

export type PaywallPlanId = 'weekly' | 'biweekly' | 'monthly';

type Props = {
  visible: boolean;
  onClose: () => void;
  onTryNativePurchaseFlow?: () => Promise<void>;
  onSelectPlan?: (plan: PaywallPlanId) => void;
};

const PLANS: {
  id: PaywallPlanId;
  title: string;
  price: string;
  perDayLabel: string;
  popular?: boolean;
}[] = [
  { id: 'weekly',   title: '1 week',   price: '$7.99',  perDayLabel: '~$1.14 / day' },
  { id: 'biweekly', title: '2 weeks',  price: '$12.99', perDayLabel: '~$0.93 / day' },
  { id: 'monthly',  title: '1 month',  price: '$19.99', perDayLabel: '~$0.67 / day', popular: true },
];

const BENEFITS = [
  { icon: 'infinite-outline',        text: 'Unlimited daily swipes' },
  { icon: 'heart-circle-outline',    text: 'See everyone who liked you' },
  { icon: 'star-outline',            text: '5 Top Picks per day' },
  { icon: 'options-outline',         text: 'Advanced search filters' },
  { icon: 'rocket-outline',          text: 'Profile boosts' },
  { icon: 'arrow-undo-outline',      text: 'Undo accidental passes' },
] as const;

export default function RoomPearPaywallModal({ visible, onClose, onTryNativePurchaseFlow, onSelectPlan }: Props) {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<PaywallPlanId>('monthly');

  const selectedMeta = PLANS.find(p => p.id === selectedPlan)!;

  function confirmPlan() {
    onSelectPlan?.(selectedPlan);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={['#F5E9C8', '#F8EED8', '#FAF3E4', '#FEFCF8', '#FFFFFF']}
        locations={[0, 0.25, 0.55, 0.80, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={s.root}
      >
        {/* Handle */}
        <View style={s.handleWrap}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <View style={s.logoRow}>
            <Image
              source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')}
              style={s.logo}
              resizeMode="contain"
            />
            <View>
              <Text style={s.eyebrow}>UNLOCK</Text>
              <Text style={s.title}>RoomPear+</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={12} activeOpacity={0.75}>
            <Ionicons name="chevron-down" size={22} color="#111111" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Benefits card */}
          <View style={s.benefitsCard}>
            {BENEFITS.map(({ icon, text }, i) => (
              <View key={text} style={[s.benefitRow, i < BENEFITS.length - 1 && s.benefitRowBorder]}>
                <View style={s.benefitIconBadge}>
                  <Ionicons name={icon as any} size={16} color="#2D6A4F" />
                </View>
                <Text style={s.benefitText}>{text}</Text>
              </View>
            ))}
          </View>

          {/* Plan selector */}
          <Text style={s.planLabel}>CHOOSE YOUR PLAN</Text>
          <View style={s.plansCard}>
            {PLANS.map((plan, i) => {
              const on = selectedPlan === plan.id;
              return (
                <TouchableOpacity
                  key={plan.id}
                  style={[s.planRow, on && s.planRowOn, i < PLANS.length - 1 && s.planRowBorder]}
                  onPress={() => setSelectedPlan(plan.id)}
                  activeOpacity={0.85}
                >
                  <View style={s.planLeft}>
                    <View style={s.planTitleRow}>
                      <Text style={[s.planTitle, on && s.planTitleOn]}>{plan.title}</Text>
                      {plan.popular && (
                        <View style={[s.popularBadge, on && s.popularBadgeOn]}>
                          <Text style={[s.popularBadgeText, on && s.popularBadgeTextOn]}>Most popular</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.planPerDay, on && s.planPerDayOn]}>{plan.perDayLabel}</Text>
                  </View>
                  <Text style={[s.planPrice, on && s.planPriceOn]}>{plan.price}</Text>
                  <View style={[s.planCheck, on && s.planCheckOn]}>
                    {on && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* CTA */}
        <View style={[s.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
          <TouchableOpacity style={s.ctaBtn} onPress={confirmPlan} activeOpacity={0.88}>
            <Text style={s.ctaText}>Continue</Text>
            <Text style={s.ctaSub}>{selectedMeta.title} · {selectedMeta.price}</Text>
          </TouchableOpacity>

          {onTryNativePurchaseFlow && (
            <TouchableOpacity style={s.nativeLink} onPress={() => void onTryNativePurchaseFlow()} activeOpacity={0.7}>
              <Text style={s.nativeLinkText}>Use App Store / Play Store checkout</Text>
            </TouchableOpacity>
          )}

          <Text style={s.footnote}>
            Billed through Apple or Google. Cancel anytime in subscription settings. Prices may vary by region.
          </Text>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  handleWrap: { alignItems: 'center', paddingTop: 10, marginBottom: 4 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(180,130,60,0.30)' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, color: '#C84200', letterSpacing: 1.2, marginBottom: 2 },
  title: { fontFamily: fonts.extraBold, fontSize: 30, color: '#111111', letterSpacing: -0.6 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.80)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.10)',
    shadowColor: '#000', shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },

  scrollContent: { paddingHorizontal: 20, paddingTop: 4 },

  // Benefits
  benefitsCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(180,130,60,0.15)',
    shadowColor: '#C84200', shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 3,
  },
  benefitRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11, gap: 12,
  },
  benefitRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(180,130,60,0.10)',
  },
  benefitIconBadge: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: 'rgba(45,106,79,0.09)',
    alignItems: 'center', justifyContent: 'center',
  },
  benefitText: { fontFamily: fonts.semiBold, fontSize: 14, color: '#111111', flex: 1 },

  // Plans
  planLabel: {
    fontFamily: fonts.bold, fontSize: 11,
    color: '#111111', letterSpacing: 0.9,
    marginBottom: 8,
  },
  plansCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(180,130,60,0.15)',
    shadowColor: '#C84200', shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 3,
  },
  planRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 14, gap: 10,
  },
  planRowOn: { backgroundColor: '#111111' },
  planRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(180,130,60,0.10)',
  },
  planLeft: { flex: 1 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  planTitle: { fontFamily: fonts.bold, fontSize: 15, color: '#111111' },
  planTitleOn: { color: '#FFFFFF' },
  planPerDay: { fontFamily: fonts.regular, fontSize: 12, color: '#7A9080' },
  planPerDayOn: { color: 'rgba(255,255,255,0.65)' },
  planPrice: { fontFamily: fonts.extraBold, fontSize: 20, color: '#111111', letterSpacing: -0.4 },
  planPriceOn: { color: '#FFFFFF' },
  planCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  planCheckOn: { backgroundColor: '#2D6A4F', borderColor: '#2D6A4F' },
  popularBadge: {
    backgroundColor: 'rgba(45,106,79,0.10)',
    borderRadius: 50, paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(45,106,79,0.18)',
  },
  popularBadgeOn: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' },
  popularBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: '#2D6A4F', letterSpacing: 0.3 },
  popularBadgeTextOn: { color: '#FFFFFF' },

  // CTA
  ctaWrap: { paddingHorizontal: 20, paddingTop: 10 },
  ctaBtn: {
    backgroundColor: '#111111', borderRadius: 18,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 6,
    marginBottom: 10,
  },
  ctaText: { fontFamily: fonts.extraBold, fontSize: 17, color: '#FFFFFF', letterSpacing: -0.2 },
  ctaSub: { fontFamily: fonts.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.70)', marginTop: 3 },
  nativeLink: { alignItems: 'center', paddingVertical: 6 },
  nativeLinkText: { fontFamily: fonts.semiBold, fontSize: 13, color: '#7A9080', textDecorationLine: 'underline' },
  footnote: {
    fontFamily: fonts.regular, fontSize: 11, color: '#A0B0A8',
    textAlign: 'center', lineHeight: 16, marginTop: 6,
  },
});
