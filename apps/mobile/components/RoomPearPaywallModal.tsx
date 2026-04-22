import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type PaywallPlanId = 'weekly' | 'biweekly' | 'monthly';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Optional: open RevenueCat / StoreKit sheet when keys and products are configured */
  onTryNativePurchaseFlow?: () => Promise<void>;
  /** Stub when payments not wired — still gives UX feedback */
  onSelectPlan?: (plan: PaywallPlanId) => void;
};

const PLANS: {
  id: PaywallPlanId;
  title: string;
  price: string;
  subtitle: string;
  popular?: boolean;
}[] = [
  {
    id: 'weekly',
    title: '1 week',
    price: '$7.99',
    subtitle: '~$1.14/day',
  },
  {
    id: 'biweekly',
    title: '2 weeks',
    price: '$12.99',
    subtitle: 'Better value',
  },
  {
    id: 'monthly',
    title: '1 month',
    price: '$19.99',
    subtitle: 'Best for active search',
    popular: true,
  },
];

export default function RoomPearPaywallModal({
  visible,
  onClose,
  onTryNativePurchaseFlow,
  onSelectPlan,
}: Props) {
  const insets = useSafeAreaInsets();

  function handlePlan(plan: PaywallPlanId) {
    onSelectPlan?.(plan);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.dragHint} />

        <View style={styles.headerRow}>
          <Text style={styles.title}>RoomPear+</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close paywall">
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <Text style={styles.lead}>
          Unlimited swipes & Top Picks, see everyone who liked you, advanced filters, boosts, and undos.
        </Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {PLANS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.card, p.popular && styles.cardPopular]}
              onPress={() => handlePlan(p.id)}
              activeOpacity={0.85}
            >
              {p.popular ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Most popular</Text>
                </View>
              ) : null}
              <View style={styles.cardRow}>
                <View>
                  <Text style={styles.cardTitle}>{p.title}</Text>
                  <Text style={styles.cardSub}>{p.subtitle}</Text>
                </View>
                <Text style={styles.cardPrice}>{p.price}</Text>
              </View>
              <Text style={styles.cardCta}>Choose plan</Text>
            </TouchableOpacity>
          ))}

          {onTryNativePurchaseFlow ? (
            <TouchableOpacity style={styles.nativeLink} onPress={() => void onTryNativePurchaseFlow()}>
              <Text style={styles.nativeLinkText}>
                Use App Store / Play Store checkout{Platform.OS === 'web' ? '' : ' (when configured)'}
              </Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.footnote}>
            Final billing runs through Apple or Google. Prices may vary by region. You can cancel anytime in
            subscription settings.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E8EEF2',
  },
  dragHint: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C0CDD6',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0C5389',
  },
  close: {
    fontSize: 22,
    color: '#189AA2',
    fontWeight: '600',
  },
  lead: {
    fontSize: 15,
    color: '#4A6070',
    lineHeight: 22,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FDFDFD',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  cardPopular: {
    borderColor: '#46BD7F',
    borderWidth: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(70,189,127,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#189AA2',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0C5389',
  },
  cardSub: {
    fontSize: 13,
    color: '#4A6070',
    marginTop: 4,
  },
  cardPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#189AA2',
  },
  cardCta: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '700',
    color: '#46BD7F',
  },
  nativeLink: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nativeLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0C5389',
    textDecorationLine: 'underline',
  },
  footnote: {
    marginTop: 16,
    fontSize: 12,
    color: '#4A6070',
    lineHeight: 18,
    textAlign: 'center',
  },
});
