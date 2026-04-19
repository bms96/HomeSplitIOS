import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/database';
import type { Share } from '@/utils/splits';

type RecurringBill = Database['public']['Tables']['recurring_bills']['Row'];
type BillCyclePayment = Database['public']['Tables']['bill_cycle_payments']['Row'];
type BillCycleAmount = Database['public']['Tables']['bill_cycle_amounts']['Row'];
type Frequency = Database['public']['Enums']['bill_cycle_frequency'];
type SplitType = Database['public']['Enums']['split_type'];

export function useRecurringBills(householdId: string | null | undefined) {
  return useQuery<RecurringBill[]>({
    queryKey: ['recurring_bills', householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_bills')
        .select('*')
        .eq('household_id', householdId!)
        .order('active', { ascending: false })
        .order('next_due_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecurringBill(id: string | null | undefined) {
  return useQuery<RecurringBill | null>({
    queryKey: ['recurring_bill', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_bills')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/**
 * Payments recorded for the current cycle across every bill in the household.
 * One row per (bill, cycle, member) the moment someone marks themselves paid.
 */
export function useBillCyclePayments(
  householdId: string | null | undefined,
  cycleId: string | null | undefined,
) {
  return useQuery<BillCyclePayment[]>({
    queryKey: ['bill_cycle_payments', householdId, cycleId],
    enabled: !!householdId && !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bill_cycle_payments')
        .select('*')
        .eq('cycle_id', cycleId!);
      if (error) throw error;
      return (data ?? []) as BillCyclePayment[];
    },
  });
}

export type SaveRecurringBillInput = {
  id?: string;
  householdId: string;
  name: string;
  amount: number | null;
  frequency: Frequency;
  nextDueDate: string;
  active: boolean;
  splitType: SplitType;
  excludedMemberIds?: string[];
  shares?: Share[];
};

export function getExcludedMemberIds(
  customSplits: Database['public']['Tables']['recurring_bills']['Row']['custom_splits'],
): string[] {
  if (
    customSplits &&
    typeof customSplits === 'object' &&
    !Array.isArray(customSplits) &&
    Array.isArray((customSplits as { excluded_member_ids?: unknown }).excluded_member_ids)
  ) {
    return (customSplits as { excluded_member_ids: unknown[] }).excluded_member_ids.filter(
      (v): v is string => typeof v === 'string',
    );
  }
  return [];
}

export function getShares(
  customSplits: Database['public']['Tables']['recurring_bills']['Row']['custom_splits'],
): Share[] {
  if (
    customSplits &&
    typeof customSplits === 'object' &&
    !Array.isArray(customSplits) &&
    Array.isArray((customSplits as { shares?: unknown }).shares)
  ) {
    return (
      (customSplits as { shares: unknown[] }).shares
        .filter(
          (s): s is { member_id: string; value: number } =>
            typeof s === 'object' &&
            s !== null &&
            typeof (s as { member_id?: unknown }).member_id === 'string' &&
            typeof (s as { value?: unknown }).value === 'number',
        )
    );
  }
  return [];
}

export function useSaveRecurringBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveRecurringBillInput) => {
      const customSplits: { [key: string]: Json | undefined } = {};
      if (input.excludedMemberIds && input.excludedMemberIds.length > 0) {
        customSplits.excluded_member_ids = input.excludedMemberIds;
      }
      if (input.shares && input.shares.length > 0) {
        customSplits.shares = input.shares.map((s) => ({
          member_id: s.member_id,
          value: s.value,
        }));
      }
      const payload = {
        household_id: input.householdId,
        name: input.name,
        amount: input.amount,
        frequency: input.frequency,
        next_due_date: input.nextDueDate,
        active: input.active,
        split_type: input.splitType,
        custom_splits: Object.keys(customSplits).length > 0 ? customSplits : null,
      };
      if (input.id) {
        const { data, error } = await supabase
          .from('recurring_bills')
          .update(payload)
          .eq('id', input.id)
          .select()
          .single();
        if (error) throw error;
        return data as RecurringBill;
      }
      const { data, error } = await supabase
        .from('recurring_bills')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as RecurringBill;
    },
    onSuccess: async (bill) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recurring_bills', bill.household_id] }),
        queryClient.invalidateQueries({ queryKey: ['recurring_bill', bill.id] }),
      ]);
    },
  });
}

/**
 * Cycle-specific amount overrides for recurring bills in the given cycle.
 * For fixed bills, the template amount still applies when no row exists here.
 * For variable bills, a row is required before any member can mark paid
 * (enforced server-side by the bcp_enforce_amount trigger).
 */
export function useBillCycleAmounts(
  householdId: string | null | undefined,
  cycleId: string | null | undefined,
) {
  return useQuery<BillCycleAmount[]>({
    queryKey: ['bill_cycle_amounts', householdId, cycleId],
    enabled: !!householdId && !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bill_cycle_amounts')
        .select('*')
        .eq('cycle_id', cycleId!);
      if (error) throw error;
      return (data ?? []) as BillCycleAmount[];
    },
  });
}

export type SetBillCycleAmountInput = {
  billId: string;
  householdId: string;
  cycleId: string;
  amount: number;
};

export function useSetBillCycleAmount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetBillCycleAmountInput) => {
      const { error } = await supabase
        .from('bill_cycle_amounts')
        .upsert(
          {
            bill_id: input.billId,
            cycle_id: input.cycleId,
            amount: input.amount,
          },
          { onConflict: 'bill_id,cycle_id' },
        );
      if (error) throw error;
      return { householdId: input.householdId, cycleId: input.cycleId };
    },
    onSuccess: ({ householdId, cycleId }) => {
      void queryClient.invalidateQueries({
        queryKey: ['bill_cycle_amounts', householdId, cycleId],
      });
    },
  });
}

export type ToggleBillPaymentInput = {
  billId: string;
  householdId: string;
  cycleId: string;
  memberId: string;
  /** If an existing bill_cycle_payments.id is passed, we delete it; otherwise we insert. */
  existingId: string | null;
};

export function useToggleBillPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ToggleBillPaymentInput) => {
      if (input.existingId) {
        const { error } = await supabase
          .from('bill_cycle_payments')
          .delete()
          .eq('id', input.existingId);
        if (error) throw error;
        return { householdId: input.householdId, cycleId: input.cycleId, billId: input.billId };
      }
      const { error } = await supabase.from('bill_cycle_payments').insert({
        bill_id: input.billId,
        cycle_id: input.cycleId,
        member_id: input.memberId,
      });
      if (error) throw error;
      return { householdId: input.householdId, cycleId: input.cycleId, billId: input.billId };
    },
    onSuccess: ({ householdId, cycleId, billId }) => {
      void queryClient.invalidateQueries({
        queryKey: ['bill_cycle_payments', householdId, cycleId],
      });
      // The advance_bill_if_fully_paid trigger (migration 014) may have
      // rolled next_due_date forward — refetch both the list and the
      // single-bill query so any open detail view reflects the new cycle.
      void queryClient.invalidateQueries({ queryKey: ['recurring_bills', householdId] });
      void queryClient.invalidateQueries({ queryKey: ['recurring_bill', billId] });
    },
  });
}

export function useDeleteRecurringBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bill: Pick<RecurringBill, 'id' | 'household_id'>) => {
      const { error } = await supabase
        .from('recurring_bills')
        .delete()
        .eq('id', bill.id);
      if (error) throw error;
      return bill;
    },
    onSuccess: (bill) => {
      void queryClient.invalidateQueries({ queryKey: ['recurring_bills', bill.household_id] });
    },
  });
}
