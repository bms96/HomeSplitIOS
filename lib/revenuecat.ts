import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { config } from '@/lib/config';

export const PRO_ENTITLEMENT_ID = 'HomeSplit Pro';

export const isExpoGo = Constants.appOwnership === 'expo';

type CustomerInfoLike = {
  entitlements: { active: Record<string, unknown> };
  originalAppUserId?: string;
};

type PurchasesModule = {
  configure: (opts: { apiKey: string; appUserID?: string | null }) => void;
  logIn: (appUserID: string) => Promise<{ customerInfo: CustomerInfoLike }>;
  logOut: () => Promise<{ customerInfo: CustomerInfoLike }>;
  getCustomerInfo: () => Promise<CustomerInfoLike>;
  setLogLevel?: (level: string) => void;
  LOG_LEVEL?: { DEBUG: string; INFO: string; WARN: string; ERROR: string };
  addCustomerInfoUpdateListener?: (cb: (info: CustomerInfoLike) => void) => void;
  removeCustomerInfoUpdateListener?: (cb: (info: CustomerInfoLike) => void) => void;
};

type PurchasesUIModule = {
  presentPaywall: (opts?: {
    offering?: unknown;
    displayCloseButton?: boolean;
  }) => Promise<string>;
  presentPaywallIfNeeded: (opts: {
    requiredEntitlementIdentifier: string;
    offering?: unknown;
    displayCloseButton?: boolean;
  }) => Promise<string>;
  presentCustomerCenter: () => Promise<void>;
  PAYWALL_RESULT: {
    NOT_PRESENTED: string;
    CANCELLED: string;
    ERROR: string;
    PURCHASED: string;
    RESTORED: string;
  };
};

let purchases: PurchasesModule | null = null;
let purchasesUI: PurchasesUIModule | null = null;
let configured = false;

function loadSdk(): PurchasesModule | null {
  if (isExpoGo) return null;
  if (purchases) return purchases;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const mod = require('react-native-purchases');
    purchases = (mod.default ?? mod) as PurchasesModule;
    return purchases;
  } catch {
    return null;
  }
}

function loadUi(): PurchasesUIModule | null {
  if (isExpoGo) return null;
  if (purchasesUI) return purchasesUI;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const mod = require('react-native-purchases-ui');
    purchasesUI = (mod.default ?? mod) as PurchasesUIModule;
    return purchasesUI;
  } catch {
    return null;
  }
}

export function isRevenueCatAvailable(): boolean {
  return !isExpoGo && loadSdk() !== null;
}

export function configureRevenueCat(appUserID?: string | null): void {
  if (configured) return;
  const sdk = loadSdk();
  if (!sdk) return;
  const apiKey =
    Platform.OS === 'ios' ? config.revenueCatIosKey : config.revenueCatAndroidKey;
  if (!apiKey) return;
  if (sdk.setLogLevel && sdk.LOG_LEVEL) {
    sdk.setLogLevel(config.isProd ? sdk.LOG_LEVEL.WARN : sdk.LOG_LEVEL.INFO);
  }
  sdk.configure({ apiKey, appUserID: appUserID ?? null });
  configured = true;
}

/**
 * Attach the RevenueCat identity to a household ID so all members share the
 * entitlement. Call after sign-in + household resolution.
 */
export async function identifyHousehold(householdId: string): Promise<void> {
  const sdk = loadSdk();
  if (!sdk || !configured) return;
  await sdk.logIn(householdId);
}

export async function resetRevenueCatIdentity(): Promise<void> {
  const sdk = loadSdk();
  if (!sdk || !configured) return;
  await sdk.logOut();
}

export async function hasProEntitlement(): Promise<boolean> {
  const sdk = loadSdk();
  if (!sdk || !configured) return false;
  const info = await sdk.getCustomerInfo();
  return !!info.entitlements.active[PRO_ENTITLEMENT_ID];
}

export async function presentPaywall(): Promise<'purchased' | 'cancelled' | 'error' | 'unavailable'> {
  const ui = loadUi();
  if (!ui) return 'unavailable';
  const result = await ui.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
    displayCloseButton: true,
  });
  if (result === ui.PAYWALL_RESULT.PURCHASED || result === ui.PAYWALL_RESULT.RESTORED) {
    return 'purchased';
  }
  if (result === ui.PAYWALL_RESULT.CANCELLED) return 'cancelled';
  if (result === ui.PAYWALL_RESULT.ERROR) return 'error';
  return 'cancelled';
}

export async function presentCustomerCenter(): Promise<'ok' | 'unavailable'> {
  const ui = loadUi();
  if (!ui) return 'unavailable';
  await ui.presentCustomerCenter();
  return 'ok';
}

export function addCustomerInfoListener(cb: () => void): () => void {
  const sdk = loadSdk();
  if (!sdk || !sdk.addCustomerInfoUpdateListener) return () => {};
  sdk.addCustomerInfoUpdateListener(cb);
  return () => sdk.removeCustomerInfoUpdateListener?.(cb);
}
