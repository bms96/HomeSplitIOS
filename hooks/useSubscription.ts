import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  addCustomerInfoListener,
  hasProEntitlement,
  isRevenueCatAvailable,
} from '@/lib/revenuecat';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Subscription = Database['public']['Tables']['subscriptions']['Row'];

/**
 * Household-level Pro state. Source of truth is the `subscriptions` row in
 * Postgres (kept fresh by the RC webhook in prod). On device we also check
 * the live RC CustomerInfo so a just-completed purchase unlocks immediately,
 * even before the webhook round-trip.
 */
export function useSubscription(householdId: string | null | undefined) {
  const query = useQuery<{ subscription: Subscription | null; isPro: boolean }>({
    queryKey: ['subscription', householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('household_id', householdId!)
        .maybeSingle();
      if (error) throw error;

      const subscription = (data as Subscription | null) ?? null;
      const dbActive = subscription?.status === 'active' || subscription?.status === 'trial';

      let rcActive = false;
      if (isRevenueCatAvailable()) {
        try {
          rcActive = await hasProEntitlement();
        } catch {
          rcActive = false;
        }
      }

      return { subscription, isPro: dbActive || rcActive };
    },
  });

  useEffect(() => {
    if (!isRevenueCatAvailable()) return;
    const unsubscribe = addCustomerInfoListener(() => {
      void query.refetch();
    });
    return unsubscribe;
  }, [query]);

  return query;
}

export function useIsPro(householdId: string | null | undefined): boolean {
  const { data } = useSubscription(householdId);
  return !!data?.isPro;
}
