import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { CustomerInfo } from 'react-native-purchases';
import { supabase } from './supabase';
import {
  subscriptionTierFromCustomerInfo,
  SUBSCRIPTION_TIER_FREE,
} from './purchasesConfig';
import { isDevPremiumForced } from './devPremiumOverride';

type PurchasesModule = typeof import('react-native-purchases').default;

function loadPurchases(): PurchasesModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-purchases').default as PurchasesModule;
  } catch {
    return null;
  }
}

function getApiKey(): string | null {
  const extra = Constants.expoConfig?.extra as
    | { revenueCatIosKey?: string; revenueCatAndroidKey?: string }
    | undefined;
  const ios = extra?.revenueCatIosKey?.trim() || process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim();
  const android =
    extra?.revenueCatAndroidKey?.trim() || process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim();
  if (Platform.OS === 'ios') return ios || null;
  if (Platform.OS === 'android') return android || null;
  return null;
}

let configurePromise: Promise<boolean> | null = null;

export async function ensureRevenueCatConfigured(): Promise<boolean> {
  const Purchases = loadPurchases();
  if (!Purchases) return false;

  if (!configurePromise) {
    configurePromise = (async () => {
      const key = getApiKey();
      if (!key) {
        if (__DEV__) {
          console.warn(
            '[RevenueCat] Set EXPO_PUBLIC_REVENUECAT_IOS_KEY and EXPO_PUBLIC_REVENUECAT_ANDROID_KEY in apps/mobile/.env'
          );
        }
        return false;
      }
      const { LOG_LEVEL } = require('react-native-purchases') as typeof import('react-native-purchases');
      await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
      Purchases.configure({ apiKey: key });
      return true;
    })();
  }
  return configurePromise;
}

export async function syncSubscriptionTierToProfile(
  userId: string,
  customerInfo: CustomerInfo
): Promise<void> {
  const tier = subscriptionTierFromCustomerInfo(customerInfo);
  if (__DEV__ && tier === SUBSCRIPTION_TIER_FREE && (await isDevPremiumForced())) {
    return;
  }
  const { error } = await supabase.from('profiles').update({ subscription_tier: tier }).eq('id', userId);
  if (error) console.warn('[RevenueCat] sync subscription_tier failed', error);
}

export async function linkUserAndSyncPurchases(userId: string): Promise<void> {
  const Purchases = loadPurchases();
  if (!Purchases) return;
  const ok = await ensureRevenueCatConfigured();
  if (!ok) return;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    await syncSubscriptionTierToProfile(userId, customerInfo);
  } catch (e) {
    console.warn('[RevenueCat] logIn failed', e);
  }
}

export async function logoutRevenueCat(): Promise<void> {
  const Purchases = loadPurchases();
  if (!Purchases) return;
  try {
    await Purchases.logOut();
  } catch {
    // ignore
  }
}

export async function getCustomerInfoSafe(): Promise<CustomerInfo | null> {
  const Purchases = loadPurchases();
  if (!Purchases) return null;
  const ok = await ensureRevenueCatConfigured();
  if (!ok) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.warn('[RevenueCat] getCustomerInfo failed', e);
    return null;
  }
}

export function addCustomerInfoListener(
  userId: string,
  onUpdate: (info: CustomerInfo) => void
): () => void {
  const Purchases = loadPurchases();
  if (!Purchases) return () => {};

  const listener = (info: CustomerInfo) => {
    syncSubscriptionTierToProfile(userId, info).catch(() => {});
    onUpdate(info);
  };
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}

/** When RevenueCat is unavailable, mark profile as free in Supabase. */
export async function markProfileTierFree(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_tier: SUBSCRIPTION_TIER_FREE })
    .eq('id', userId);
  if (error) console.warn('[RevenueCat] markProfileTierFree failed', error);
}
