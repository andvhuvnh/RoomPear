jest.mock('react-native-purchases', () => {
  const PURCHASES_ERROR_CODE = { PURCHASE_CANCELLED_ERROR: '1' };
  return {
    __esModule: true,
    default: {
      configure: jest.fn(),
      logIn: jest.fn(() =>
        Promise.resolve({
          customerInfo: { entitlements: { active: {} } },
        })
      ),
      logOut: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
      getCustomerInfo: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
      addCustomerInfoUpdateListener: jest.fn(),
      removeCustomerInfoUpdateListener: jest.fn(),
      setLogLevel: jest.fn(() => Promise.resolve()),
      PURCHASES_ERROR_CODE,
    },
    LOG_LEVEL: { DEBUG: 'DEBUG', WARN: 'WARN' },
    PURCHASES_ERROR_CODE,
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-purchases-ui', () => {
  const PAYWALL_RESULT = {
    NOT_PRESENTED: 'NOT_PRESENTED',
    ERROR: 'ERROR',
    CANCELLED: 'CANCELLED',
    PURCHASED: 'PURCHASED',
    RESTORED: 'RESTORED',
  };
  return {
    __esModule: true,
    default: {
      presentPaywall: jest.fn(() => Promise.resolve(PAYWALL_RESULT.NOT_PRESENTED)),
      presentPaywallIfNeeded: jest.fn(() => Promise.resolve(PAYWALL_RESULT.NOT_PRESENTED)),
      presentCustomerCenter: jest.fn(() => Promise.resolve()),
    },
    PAYWALL_RESULT,
  };
});
