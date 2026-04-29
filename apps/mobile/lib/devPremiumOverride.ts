import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@roompear/dev_force_premium';

/** When true, RevenueCat sync must not overwrite `profiles.subscription_tier` back to free (dev testing only). */
export async function setDevPremiumForced(value: boolean): Promise<void> {
  if (!__DEV__) return;
  if (value) {
    await AsyncStorage.setItem(STORAGE_KEY, '1');
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

export async function isDevPremiumForced(): Promise<boolean> {
  if (!__DEV__) return false;
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === '1';
  } catch {
    return false;
  }
}
