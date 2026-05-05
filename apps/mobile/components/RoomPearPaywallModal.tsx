import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
  FlatList,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { CHATS_GREEN, CHATS_GREEN_DARK } from '../theme/chatsAmbient';

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
  /** Shown under the plan price (≈ total ÷ days in period). */
  perDayLabel: string;
  popular?: boolean;
}[] = [
  {
    id: 'weekly',
    title: '1 week',
    price: '$7.99',
    perDayLabel: '~$1.14/day',
  },
  {
    id: 'biweekly',
    title: '2 weeks',
    price: '$12.99',
    perDayLabel: '~$0.93/day',
  },
  {
    id: 'monthly',
    title: '1 month',
    price: '$19.99',
    perDayLabel: '~$0.67/day',
    popular: true,
  },
];

const PREMIUM_BENEFITS = [
  'Unlimited daily swipes',
  'More Top Picks',
  'See everyone who liked you',
  'Advanced search filters',
  'Profile boosts',
  'Undo accidental passes',
] as const;

/** Deep base — high contrast vs gloss layers */
const BG = '#030A07';

/** Virtual ring length (week → biweek → month → …); recenters before edges. */
const RING_LEN = 51;
/** Index where `i % 3 === 0` is weekly (align recenter jumps). */
const RING_BASE = 24;
const RING_START_MONTHLY = RING_BASE + 2;
const RING_RECENTER_LOW = 10;
const RING_RECENTER_HIGH = RING_LEN - 1 - 10;

type RingItem = { ringIndex: number; plan: (typeof PLANS)[number] };

function planPhaseFromRingIndex(i: number): PaywallPlanId {
  return PLANS[i % 3]!.id;
}

/** Stronger opacity on immediate neighbors so short titles ("1 week", "2 weeks") stay readable. */
function opacityForDistance(distInStrides: number): number {
  const d = Math.abs(distInStrides);
  if (d < 0.15) return 1;
  if (d < 1.03) {
    const t = (d - 0.15) / (1.03 - 0.15);
    return 1 + t * (0.84 - 1);
  }
  if (d < 1.65) {
    const t = (d - 1.03) / (1.65 - 1.03);
    return 0.84 + t * (0.58 - 0.84);
  }
  return 0.58;
}

/** Slight emphasis on center tile in a tight 3-across carousel. */
function scaleForDistance(distInStrides: number): number {
  const d = Math.abs(distInStrides);
  const center = 1.02;
  const far = 0.965;
  if (d < 0.11) return center;
  if (d < 1.06) {
    const t = (d - 0.11) / (1.06 - 0.11);
    return center + t * (far - center);
  }
  return far;
}

const PlanRingCard = memo(function PlanRingCard({
  plan,
  fade,
  scale,
  cardWidth,
  tileMinHeight,
  focused,
  peekLegible,
}: {
  plan: (typeof PLANS)[number];
  fade: number;
  scale: number;
  cardWidth: number;
  /** Portrait tiles: taller than wide (similar to Fitness-style paywall stacks). */
  tileMinHeight: number;
  focused: boolean;
  peekLegible: boolean;
}) {
  return (
    <View
      style={[
        styles.ringCardWrap,
        { width: cardWidth, opacity: fade, transform: [{ scale }] },
      ]}
    >
      <View
        style={[
          styles.windowOuter,
          focused && styles.windowOuterFocused,
        ]}
      >
        <BlurView
          intensity={peekLegible ? 32 : 36}
          tint="light"
          style={[
            styles.windowBlur,
            peekLegible && styles.windowBlurPeek,
            focused && styles.windowBlurFocused,
          ]}
          {...(Platform.OS === 'android'
            ? { experimentalBlurMethod: 'dimezisBlurView' as const }
            : {})}
        >
          <View style={[styles.windowInner, { height: tileMinHeight }]}>
            <View style={styles.windowTop}>
              <Text
                style={[styles.windowTitle, peekLegible && styles.windowTitlePeek]}
                numberOfLines={2}
              >
                {plan.title}
              </Text>
              {plan.popular ? (
                <View style={styles.popularBadgeInset} pointerEvents="none">
                  <Text style={styles.popularBadgeText}>Most popular</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.windowSpacer} />
            <View style={styles.windowBottom}>
              <Text
                style={styles.windowPrice}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {plan.price}
              </Text>
              <Text style={styles.windowSub} numberOfLines={1}>
                {plan.perDayLabel}
              </Text>
            </View>
          </View>
        </BlurView>
      </View>
    </View>
  );
});

function PaywallBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bgRoot}>
      {/* Primary depth: near-black forest → rich moss → bright mint lift */}
      <LinearGradient
        colors={['#020504', '#0A1A14', '#142920', '#1A3329', '#2D6A4F', '#5C9E7A', '#B5DEC8', '#F2FBF6']}
        locations={[0, 0.12, 0.22, 0.34, 0.48, 0.62, 0.82, 1]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.55, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Cool rim light (glossy edge) */}
      <LinearGradient
        colors={['rgba(180, 230, 210, 0.22)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0)']}
        locations={[0, 0.35, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 0.55 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Specular sweep — liquid / lacquer highlight */}
      <LinearGradient
        colors={[
          'rgba(255,255,255,0)',
          'rgba(255,255,255,0.06)',
          'rgba(255,255,255,0.42)',
          'rgba(255,255,255,0.12)',
          'rgba(255,255,255,0)',
        ]}
        locations={[0.28, 0.4, 0.48, 0.56, 0.72]}
        start={{ x: 0, y: 0.15 }}
        end={{ x: 1, y: 0.85 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Secondary narrow gleam */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
        locations={[0.42, 0.5, 0.58]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.35, y: 0.45 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Bottom pool of light — extra gloss vs shadowed top */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.38)']}
        locations={[0.55, 0.78, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

export default function RoomPearPaywallModal({
  visible,
  onClose,
  onTryNativePurchaseFlow,
  onSelectPlan,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<RingItem>>(null);
  const [selectedPlan, setSelectedPlan] = useState<PaywallPlanId>('monthly');
  const [scrollX, setScrollX] = useState(0);
  const scrollXRef = useRef(0);
  const lastScrollEmit = useRef(0);

  const { cardWidth, tileMinHeight, stride, sidePad, loopData } = useMemo(() => {
    /**
     * ~3 portrait tiles across (tight gutters), like common fitness paywalls — infinite ring unchanged.
     */
    const betweenCards = 9;
    const edgePad = 12;
    const inner = windowWidth - 2 * edgePad - 2 * betweenCards;
    const cw = Math.max(88, Math.min(122, Math.floor(inner / 3)));
    const st = cw + betweenCards;
    const pad = Math.max(edgePad, Math.round((windowWidth - cw) / 2));
    const tileH = Math.round(cw * 1.4);
    const data: RingItem[] = Array.from({ length: RING_LEN }, (_, ringIndex) => ({
      ringIndex,
      plan: PLANS[ringIndex % 3]!,
    }));
    return { cardWidth: cw, tileMinHeight: tileH, stride: st, sidePad: pad, loopData: data };
  }, [windowWidth]);

  /** Header + items + footer; each item cell is `stride` wide with the card centered in the cell. */
  const maxScroll = useMemo(
    () => Math.max(0, sidePad + RING_LEN * stride + sidePad - windowWidth),
    [sidePad, stride, windowWidth]
  );

  const snapOffsets = useMemo(
    () =>
      Array.from({ length: RING_LEN }, (_, i) => {
        const cardCenter = sidePad + i * stride + stride / 2;
        const ideal = cardCenter - windowWidth / 2;
        return Math.max(0, Math.min(maxScroll, ideal));
      }),
    [maxScroll, sidePad, stride, windowWidth]
  );

  const scrollToRingIndex = useCallback(
    (ringIndex: number, animated: boolean) => {
      const i = Math.max(0, Math.min(RING_LEN - 1, ringIndex));
      const off = snapOffsets[i] ?? 0;
      listRef.current?.scrollToOffset({ offset: off, animated });
    },
    [snapOffsets]
  );

  const applyScrollMetrics = useCallback(
    (offsetX: number, opts?: { recenter?: boolean }) => {
      const raw = (offsetX + windowWidth / 2 - sidePad - stride / 2) / stride;
      let idx = Math.round(raw);
      idx = Math.max(0, Math.min(RING_LEN - 1, idx));

      if (opts?.recenter && (idx < RING_RECENTER_LOW || idx > RING_RECENTER_HIGH)) {
        const phase = idx % 3;
        idx = RING_BASE + phase;
        scrollToRingIndex(idx, false);
      }

      const snapped = snapOffsets[idx] ?? 0;
      scrollXRef.current = snapped;
      setScrollX(snapped);
      setSelectedPlan(planPhaseFromRingIndex(idx));
    },
    [scrollToRingIndex, sidePad, snapOffsets, stride, windowWidth]
  );

  useEffect(() => {
    if (!visible) return;
    setSelectedPlan('monthly');
    const id = requestAnimationFrame(() => {
      scrollToRingIndex(RING_START_MONTHLY, false);
      const off = snapOffsets[RING_START_MONTHLY] ?? 0;
      scrollXRef.current = off;
      setScrollX(off);
    });
    return () => cancelAnimationFrame(id);
  }, [visible, scrollToRingIndex, snapOffsets]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      scrollXRef.current = x;
      const now = Date.now();
      if (now - lastScrollEmit.current > 28) {
        lastScrollEmit.current = now;
        setScrollX(x);
      }
    },
    []
  );

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      applyScrollMetrics(e.nativeEvent.contentOffset.x, { recenter: true });
    },
    [applyScrollMetrics]
  );

  /** Move carousel to the nearest ring index for this plan (swipe still works for fine control). */
  const jumpToPlan = useCallback(
    (planId: PaywallPlanId) => {
      setSelectedPlan(planId);
      const phase = PLANS.findIndex((p) => p.id === planId);
      const scrollApprox = Math.max(
        0,
        Math.min(
          RING_LEN - 1,
          Math.round((scrollXRef.current + windowWidth / 2 - sidePad - stride / 2) / stride)
        )
      );
      let best = RING_BASE + phase;
      let bestD = Infinity;
      for (let i = 0; i < RING_LEN; i++) {
        if (i % 3 !== phase) continue;
        const d = Math.abs(i - scrollApprox);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      scrollToRingIndex(best, true);
    },
    [scrollToRingIndex, sidePad, stride, windowWidth]
  );

  function confirmPlan() {
    onSelectPlan?.(selectedPlan);
  }

  const selectedPlanMeta = useMemo(
    () => PLANS.find((p) => p.id === selectedPlan),
    [selectedPlan]
  );

  /** Offsets are for data rows only; `ListHeaderComponent` width matches `sidePad`. */
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: stride,
      offset: index * stride,
      index,
    }),
    [stride]
  );

  const listHeader = useMemo(
    () => <View style={{ width: sidePad }} />,
    [sidePad]
  );
  const listFooter = useMemo(
    () => <View style={{ width: sidePad }} />,
    [sidePad]
  );

  const renderRingItem = useCallback(
    ({ item, index }: { item: RingItem; index: number }) => {
      const viewportCenter = scrollX + windowWidth / 2;
      const cardCenter = sidePad + index * stride + stride / 2;
      const dist = (viewportCenter - cardCenter) / stride;
      const fade = opacityForDistance(dist);
      const sc = scaleForDistance(dist);
      const focused = Math.abs(dist) < 0.13;
      const peekLegible = Math.abs(dist) > 0.14 && Math.abs(dist) < 1.06;
      return (
        <Pressable
          onPress={() => jumpToPlan(item.plan.id)}
          accessibilityRole="button"
          accessibilityLabel={
            item.plan.popular
              ? `Select ${item.plan.title} for ${item.plan.price}, most popular`
              : `Select ${item.plan.title} for ${item.plan.price}`
          }
          style={[styles.ringStride, { width: stride, zIndex: focused ? 6 : 0 }]}
        >
          <PlanRingCard
            plan={item.plan}
            fade={fade}
            scale={sc}
            cardWidth={cardWidth}
            tileMinHeight={tileMinHeight}
            focused={focused}
            peekLegible={peekLegible}
          />
        </Pressable>
      );
    },
    [cardWidth, jumpToPlan, scrollX, sidePad, stride, tileMinHeight, windowWidth]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <PaywallBackground>
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <View style={styles.dragHintWrap}>
            <View style={styles.dragHint} />
          </View>

          <View style={styles.headerRow}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.kicker}>Unlock</Text>
              <Text style={styles.title}>RoomPear+</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close paywall"
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            >
              <BlurView
                intensity={28}
                tint="light"
                style={styles.closeBlur}
                {...(Platform.OS === 'android'
                  ? { experimentalBlurMethod: 'dimezisBlurView' as const }
                  : {})}
              >
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.92)" />
              </BlurView>
            </Pressable>
          </View>

          <View style={styles.body}>
            <View style={[styles.bodyPad, styles.benefitsBelowHeader]}>
              <View style={styles.leadGlass}>
                {PREMIUM_BENEFITS.map((line, i) => (
                  <View
                    key={line}
                    style={[styles.benefitRow, i === PREMIUM_BENEFITS.length - 1 && styles.benefitRowLast]}
                  >
                    <Ionicons name="checkmark-circle" size={20} color={CHATS_GREEN} style={styles.benefitIcon} />
                    <Text style={styles.benefitText}>{line}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.plansRegion, { width: windowWidth }]}>
              <View style={styles.plansUpperSpacer} />
              <Text style={styles.planBlockTitle} accessibilityRole="header">
                Choose your plan
              </Text>
              <View
                style={[styles.carouselSection, { width: windowWidth, height: tileMinHeight + 28 }]}
              >
                <FlatList
                  ref={listRef}
                  data={loopData}
                  extraData={scrollX}
                  keyExtractor={(it) => String(it.ringIndex)}
                  renderItem={renderRingItem}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  bounces
                  decelerationRate="fast"
                  snapToOffsets={snapOffsets}
                  getItemLayout={getItemLayout}
                  ListHeaderComponent={listHeader}
                  ListFooterComponent={listFooter}
                  removeClippedSubviews={false}
                  onScroll={onScroll}
                  scrollEventThrottle={16}
                  onMomentumScrollEnd={onScrollEnd}
                  onScrollEndDrag={onScrollEnd}
                  style={{ width: windowWidth, height: tileMinHeight + 28 }}
                  accessibilityRole="adjustable"
                  accessibilityLabel="Choose your plan — tap a card or swipe to select a billing period."
                />
              </View>
            </View>

            <View style={styles.ctaArea}>
              <TouchableOpacity
                style={styles.continueTouch}
                onPress={confirmPlan}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Continue with selected RoomPear plus plan"
              >
                <LinearGradient
                  colors={[CHATS_GREEN, '#245A43']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.continueGradient}
                >
                  <View style={styles.continueLabelCol}>
                    <Text style={styles.continueText}>Continue</Text>
                    {selectedPlanMeta ? (
                      <Text style={styles.continueSub} numberOfLines={1}>
                        {selectedPlanMeta.title} · {selectedPlanMeta.price}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="arrow-forward" size={22} color="#FFFFFF" style={styles.continueIcon} />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={[styles.bodyPad, styles.bottomTail, { paddingBottom: Math.max(16, insets.bottom + 10) }]}>
              {onTryNativePurchaseFlow ? (
                <TouchableOpacity style={styles.nativeLink} onPress={() => void onTryNativePurchaseFlow()}>
                  <Text style={styles.nativeLinkText} numberOfLines={1}>
                    Use App Store / Play Store checkout{Platform.OS === 'web' ? '' : ' (when configured)'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <Text style={styles.footnote} numberOfLines={3}>
                Final billing runs through Apple or Google. Prices may vary by region. You can cancel anytime in
                subscription settings.
              </Text>
            </View>
          </View>
        </View>
      </PaywallBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bgRoot: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    flex: 1,
  },
  dragHintWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  dragHint: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 18,
  },
  headerTitleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  kicker: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.68)',
    marginBottom: 4,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#F4FFFA',
    letterSpacing: -0.6,
    textShadowColor: 'rgba(0, 0, 0, 0.38)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  closeBtn: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  closeBtnPressed: {
    opacity: 0.85,
  },
  closeBlur: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  bodyPad: {
    paddingHorizontal: 20,
  },
  benefitsBelowHeader: {
    marginTop: 6,
  },
  leadGlass: {
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    paddingVertical: 11,
    paddingHorizontal: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.14,
        shadowRadius: 18,
      },
      android: { elevation: 4 },
    }),
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 7,
  },
  benefitRowLast: {
    marginBottom: 0,
  },
  benefitIcon: {
    marginRight: 9,
    marginTop: 1,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: CHATS_GREEN_DARK,
    fontWeight: '700',
    letterSpacing: -0.15,
  },
  plansRegion: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
  },
  /** Pushes heading + carousel toward the footer on tall layouts. */
  plansUpperSpacer: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 2,
    maxHeight: 44,
  },
  planBlockTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: 'white',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  carouselSection: {
    flexGrow: 0,
    width: '100%',
    alignSelf: 'center',
  },
  ringStride: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    overflow: 'visible',
  },
  ringCardWrap: {
    alignSelf: 'center',
  },
  /** In-card chip under title (Fitness-style stacked plans). */
  popularBadgeInset: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: CHATS_GREEN,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignSelf: 'center',
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  windowOuter: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.82)',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 22,
      },
      android: { elevation: 5 },
    }),
  },
  windowOuterFocused: {
    borderColor: CHATS_GREEN,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: CHATS_GREEN,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
        shadowRadius: 20,
      },
      android: { elevation: 10 },
    }),
  },
  windowBlur: {
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
  },
  windowBlurPeek: {
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
  },
  windowBlurFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
  },
  windowInner: {
    flexDirection: 'column',
    paddingVertical: 12,
    paddingHorizontal: 8,
    width: '100%',
  },
  windowTop: {
    alignItems: 'center',
    width: '100%',
  },
  windowSpacer: {
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 4,
  },
  windowBottom: {
    alignItems: 'center',
    width: '100%',
  },
  windowTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: CHATS_GREEN_DARK,
    letterSpacing: -0.38,
    textAlign: 'center',
    width: '100%',
  },
  /** Adjacent carousel tiles: readable at small widths. */
  windowTitlePeek: {
    fontSize: 16,
    letterSpacing: -0.42,
  },
  windowPrice: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '800',
    color: CHATS_GREEN,
    letterSpacing: -0.7,
    textAlign: 'center',
  },
  windowSub: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 13,
    color: 'rgba(26, 44, 36, 0.55)',
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
  /** Same gradient as the rest of the sheet — no separate toolbar strip. */
  ctaArea: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  bottomTail: {
    paddingTop: 6,
  },
  continueTouch: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 22,
    gap: 10,
  },
  continueLabelCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  continueText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.25,
  },
  continueSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.88)',
    letterSpacing: -0.1,
  },
  continueIcon: {
    marginLeft: 4,
  },
  nativeLink: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  nativeLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: CHATS_GREEN_DARK,
    textDecorationLine: 'underline',
  },
  footnote: {
    marginTop: 4,
    marginBottom: 4,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    color: 'rgba(26, 44, 36, 0.5)',
    paddingHorizontal: 2,
  },
});
