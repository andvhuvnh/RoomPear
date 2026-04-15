import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Alert, Platform } from 'react-native';
import type { CustomerInfo } from 'react-native-purchases';
import { hasRoomPearPlusEntitlement } from '../lib/purchasesConfig';
import {
  addCustomerInfoListener,
  ensureRevenueCatConfigured,
  getCustomerInfoSafe,
  linkUserAndSyncPurchases,
  logoutRevenueCat,
  syncSubscriptionTierToProfile,
} from '../lib/revenuecat';
import RoomPearPaywallModal, { type PaywallPlanId } from '../components/RoomPearPaywallModal';

type PurchasesContextValue = {
  customerInfo: CustomerInfo | null;
  isRoomPearPlus: boolean;
  isReady: boolean;
  refreshCustomerInfo: () => Promise<void>;
  presentPaywall: () => Promise<void>;
  presentPaywallIfNeeded: () => Promise<void>;
  presentCustomerCenter: () => Promise<void>;
  logoutPurchases: () => Promise<void>;
};

const defaultValue: PurchasesContextValue = {
  customerInfo: null,
  isRoomPearPlus: false,
  isReady: false,
  refreshCustomerInfo: async () => {},
  presentPaywall: async () => {},
  presentPaywallIfNeeded: async () => {},
  presentCustomerCenter: async () => {},
  logoutPurchases: async () => {},
};

const PurchasesContext = createContext<PurchasesContextValue>(defaultValue);

function loadRevenueCatUI(): {
  default: typeof import('react-native-purchases-ui').default;
  PAYWALL_RESULT: typeof import('react-native-purchases-ui').PAYWALL_RESULT;
} | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-purchases-ui') as typeof import('react-native-purchases-ui');
  } catch {
    return null;
  }
}

export function PurchasesProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [roomPearPaywallVisible, setRoomPearPaywallVisible] = useState(false);

  const isRoomPearPlus = useMemo(
    () => hasRoomPearPlusEntitlement(customerInfo),
    [customerInfo]
  );

  const refreshCustomerInfo = useCallback(async () => {
    const info = await getCustomerInfoSafe();
    setCustomerInfo(info);
    if (info) await syncSubscriptionTierToProfile(userId, info);
  }, [userId]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsReady(true);
      return;
    }

    let removeListener: (() => void) | undefined;

    const run = async () => {
      const ok = await ensureRevenueCatConfigured();
      if (!ok) {
        setIsReady(true);
        return;
      }
      await linkUserAndSyncPurchases(userId);
      const info = await getCustomerInfoSafe();
      setCustomerInfo(info);
      removeListener = addCustomerInfoListener(userId, (next) => {
        setCustomerInfo(next);
      });
      setIsReady(true);
    };

    run();

    return () => {
      removeListener?.();
    };
  }, [userId]);

  const tryPresentRevenueCatNativePaywall = useCallback(async () => {
    const mod = loadRevenueCatUI();
    if (!mod) {
      Alert.alert('Store checkout', 'Use the iOS or Android app with RevenueCat configured.');
      return;
    }
    const ok = await ensureRevenueCatConfigured();
    if (!ok) {
      Alert.alert(
        'Store checkout',
        'Add your public SDK keys to apps/mobile/.env (EXPO_PUBLIC_REVENUECAT_IOS_KEY / ANDROID_KEY) and configure products in RevenueCat.'
      );
      return;
    }
    try {
      const { PAYWALL_RESULT } = mod;
      const result = await mod.default.presentPaywall({});
      if (
        result === PAYWALL_RESULT.PURCHASED ||
        result === PAYWALL_RESULT.RESTORED ||
        result === PAYWALL_RESULT.NOT_PRESENTED
      ) {
        await refreshCustomerInfo();
        setRoomPearPaywallVisible(false);
      } else if (result === PAYWALL_RESULT.ERROR) {
        Alert.alert('Subscriptions', 'Something went wrong. Please try again.');
      }
    } catch (e: unknown) {
      console.warn('[RevenueCatUI] presentPaywall', e);
      Alert.alert('Subscriptions', 'Could not open the native purchase sheet.');
    }
  }, [refreshCustomerInfo]);

  const presentPaywall = useCallback(async () => {
    setRoomPearPaywallVisible(true);
  }, []);

  const presentPaywallIfNeeded = useCallback(async () => {
    if (isRoomPearPlus) return;
    setRoomPearPaywallVisible(true);
  }, [isRoomPearPlus]);

  const handlePaywallSelectPlan = useCallback((plan: PaywallPlanId) => {
    const labels: Record<PaywallPlanId, string> = {
      weekly: '1 week · $7.99',
      biweekly: '2 weeks · $12.99',
      monthly: '1 month · $19.99 (most popular)',
    };
    Alert.alert(
      'RoomPear+',
      `Plan: ${labels[plan]}\n\nCheckout isn’t connected in this build yet — this is a preview. Use “App Store / Play Store checkout” below when RevenueCat and store products are ready.`,
      [{ text: 'OK', onPress: () => setRoomPearPaywallVisible(false) }]
    );
  }, []);

  const presentCustomerCenter = useCallback(async () => {
    const mod = loadRevenueCatUI();
    if (!mod) {
      Alert.alert(
        'Manage subscription',
        'Open the App Store or Play Store subscription settings on your device.'
      );
      return;
    }
    const ok = await ensureRevenueCatConfigured();
    if (!ok) {
      Alert.alert('Manage subscription', 'Payment system is not configured yet.');
      return;
    }
    try {
      await mod.default.presentCustomerCenter({});
      await refreshCustomerInfo();
    } catch (e: unknown) {
      console.warn('[RevenueCatUI] presentCustomerCenter', e);
      Alert.alert(
        'Customer Center',
        'Unable to open Customer Center. Enable it in the RevenueCat dashboard (Pro/Enterprise) and try again.'
      );
    }
  }, [refreshCustomerInfo]);

  const logoutPurchases = useCallback(async () => {
    await logoutRevenueCat();
    setCustomerInfo(null);
  }, []);

  const value = useMemo<PurchasesContextValue>(
    () => ({
      customerInfo,
      isRoomPearPlus,
      isReady,
      refreshCustomerInfo,
      presentPaywall,
      presentPaywallIfNeeded,
      presentCustomerCenter,
      logoutPurchases,
    }),
    [
      customerInfo,
      isRoomPearPlus,
      isReady,
      refreshCustomerInfo,
      presentPaywall,
      presentPaywallIfNeeded,
      presentCustomerCenter,
      logoutPurchases,
    ]
  );

  return (
    <PurchasesContext.Provider value={value}>
      {children}
      <RoomPearPaywallModal
        visible={roomPearPaywallVisible}
        onClose={() => setRoomPearPaywallVisible(false)}
        onSelectPlan={handlePaywallSelectPlan}
        onTryNativePurchaseFlow={
          Platform.OS === 'web'
            ? undefined
            : () => tryPresentRevenueCatNativePaywall()
        }
      />
    </PurchasesContext.Provider>
  );
}

export function usePurchases(): PurchasesContextValue {
  return useContext(PurchasesContext);
}
