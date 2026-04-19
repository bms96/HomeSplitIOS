import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useCurrentHousehold } from '@/hooks/useHousehold';
import { useIsPro } from '@/hooks/useSubscription';
import { isExpoGo, isRevenueCatAvailable, presentPaywall } from '@/lib/revenuecat';

type Trigger = 'third_member' | 'third_recurring_bill' | 'move_out';

const COPY: Record<Trigger, { title: string; body: string }> = {
  third_member: {
    title: 'Upgrade to add more roommates',
    body: 'Homesplit Free supports up to 2 members. Upgrade to Pro for unlimited.',
  },
  third_recurring_bill: {
    title: 'Upgrade to add more recurring bills',
    body: 'Homesplit Free supports up to 2 recurring bills. Upgrade to Pro for unlimited.',
  },
  move_out: {
    title: 'Move-out is a Pro feature',
    body: 'The automated move-out flow handles settlement, proration, and member closeout. Upgrade to use it.',
  },
};

/**
 * Hook-form of the paywall gate. Returns a function that either:
 *   - runs `action` immediately if the household has Pro, or
 *   - presents the paywall, and on successful purchase runs `action`.
 */
export function usePaywallGate(trigger: Trigger) {
  const { data: membership } = useCurrentHousehold();
  const householdId = membership?.household_id ?? null;
  const isPro = useIsPro(householdId);

  return useCallback(
    async (action: () => void | Promise<void>) => {
      if (isPro) {
        await action();
        return;
      }

      if (isExpoGo || !isRevenueCatAvailable()) {
        Alert.alert(
          COPY[trigger].title,
          `${COPY[trigger].body}\n\nThe paywall requires a development build — it can't run in Expo Go.`,
        );
        return;
      }

      const result = await presentPaywall();
      if (result === 'purchased') {
        await action();
      }
    },
    [isPro, trigger],
  );
}
