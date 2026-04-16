import { supabase } from './supabase';

const PENDING_REFERRAL_KEY = 'roompear_pending_referral_code';

export type RedeemReferralResult =
  | { success: true }
  | {
      success: false;
      error:
        | 'not_authenticated'
        | 'invalid_code'
        | 'not_found'
        | 'self_referral'
        | 'already_referred'
        | 'already_redeemed'
        | 'unknown';
    };

type AsyncStorageShape = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function getAsyncStorage(): AsyncStorageShape {
  // Lazy require keeps test/runtime compatibility across Expo + Jest.
  return require('@react-native-async-storage/async-storage').default as AsyncStorageShape;
}

export async function getPendingReferralCode(): Promise<string | null> {
  const AsyncStorage = getAsyncStorage();
  const raw = await AsyncStorage.getItem(PENDING_REFERRAL_KEY);
  const t = raw?.trim();
  return t ? t.toUpperCase() : null;
}

export async function setPendingReferralCode(code: string | null): Promise<void> {
  const AsyncStorage = getAsyncStorage();
  if (!code?.trim()) {
    await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
    return;
  }
  await AsyncStorage.setItem(PENDING_REFERRAL_KEY, code.trim().toUpperCase());
}

/** Call after session is available (e.g. sign-in or app start). Clears pending code on success or definitive failure. */
export async function redeemPendingReferralIfAny(): Promise<RedeemReferralResult | null> {
  const pending = await getPendingReferralCode();
  if (!pending) return null;
  const result = await redeemReferralCode(pending);
  if (result.success) {
    await setPendingReferralCode(null);
  } else if (
    result.error !== 'unknown' &&
    result.error !== 'not_authenticated'
  ) {
    await setPendingReferralCode(null);
  }
  return result;
}

export async function redeemReferralCode(code: string): Promise<RedeemReferralResult> {
  const cleaned = code.trim().toUpperCase();
  if (cleaned.length < 4) {
    return { success: false, error: 'invalid_code' };
  }

  const { data, error } = await supabase.rpc('redeem_referral_code', { p_code: cleaned });

  if (error) {
    console.warn('redeem_referral_code rpc error', error);
    return { success: false, error: 'unknown' };
  }

  const row = data as { success?: boolean; error?: string } | null;
  if (row?.success === true) {
    return { success: true };
  }

  const err = row?.error;
  if (
    err === 'not_authenticated' ||
    err === 'invalid_code' ||
    err === 'not_found' ||
    err === 'self_referral' ||
    err === 'already_referred' ||
    err === 'already_redeemed'
  ) {
    return { success: false, error: err };
  }

  return { success: false, error: 'unknown' };
}

export function redeemErrorMessage(
  error: Extract<RedeemReferralResult, { success: false }>['error']
): string {
  const map: Record<string, string> = {
    invalid_code: 'Enter a valid code.',
    not_found: 'That code was not found.',
    self_referral: 'You cannot use your own code.',
    already_referred: 'A referral is already linked to your account.',
    already_redeemed: 'You have already used a referral.',
    not_authenticated: 'Sign in to apply a referral code.',
    unknown: 'Something went wrong. Try again.',
  };
  return map[error] ?? map.unknown;
}

