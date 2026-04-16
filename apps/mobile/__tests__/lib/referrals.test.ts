const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();
const mockRpc = jest.fn();

function loadReferralsModule() {
  jest.resetModules();
  jest.doMock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
      getItem: (...args: unknown[]) => mockGetItem(...args),
      setItem: (...args: unknown[]) => mockSetItem(...args),
      removeItem: (...args: unknown[]) => mockRemoveItem(...args),
    },
  }));
  jest.doMock('../../lib/supabase', () => ({
    supabase: {
      rpc: (...args: unknown[]) => mockRpc(...args),
    },
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../lib/referrals');
}

describe('referrals integration behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores pending referral code uppercased', async () => {
    const referrals = loadReferralsModule();
    await referrals.setPendingReferralCode(' ab12cd34 ');

    expect(mockSetItem).toHaveBeenCalledWith('roompear_pending_referral_code', 'AB12CD34');
  });

  it('clears pending code on successful pending redemption', async () => {
    const referrals = loadReferralsModule();
    mockGetItem.mockResolvedValueOnce('ABCD1234');
    mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    const result = await referrals.redeemPendingReferralIfAny();

    expect(mockRpc).toHaveBeenCalledWith('redeem_referral_code', { p_code: 'ABCD1234' });
    expect(mockRemoveItem).toHaveBeenCalledWith('roompear_pending_referral_code');
    expect(result).toEqual({ success: true });
  });

  it('keeps pending code when redemption fails with unknown', async () => {
    const referrals = loadReferralsModule();
    mockGetItem.mockResolvedValueOnce('ABCD1234');
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'network' } });

    const result = await referrals.redeemPendingReferralIfAny();

    expect(mockRemoveItem).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: 'unknown' });
  });

  it('maps backend known errors from redeem rpc', async () => {
    const referrals = loadReferralsModule();
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error: 'self_referral' },
      error: null,
    });

    const result = await referrals.redeemReferralCode('self1234');

    expect(result).toEqual({ success: false, error: 'self_referral' });
  });
});
