import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import {
  computeNetBalances,
  computePairwiseDebts,
  simplifyDebts,
  type Debt,
  type MemberNetBalance,
} from '@/utils/debts';

type SettlementMethod = Database['public']['Enums']['settlement_method'];
type SettlementRow = Database['public']['Tables']['settlements']['Row'];
type MemberLite = Pick<Database['public']['Tables']['members']['Row'], 'id' | 'display_name' | 'color'>;

export type SettlementWithMembers = SettlementRow & {
  from_member: MemberLite | null;
  to_member: MemberLite | null;
};

type UnsettledSplitRow = {
  member_id: string;
  amount_owed: number;
  expense: { paid_by_member_id: string } | null;
};

type BalanceResult = {
  /** Fully simplified debt graph — may chain through intermediaries. Use for counts/overviews. */
  debts: Debt[];
  /** Per-pair net debts — always match real splits. Use for settle-up actions. */
  pairwiseDebts: Debt[];
  netByMember: MemberNetBalance[];
};

/**
 * Returns simplified debts and net balances for the current open cycle.
 * Only considers unsettled splits. When a member paid for their own split
 * (common for the payer), that split is a no-op and ignored.
 */
export function useBalances(
  householdId: string | null | undefined,
  cycleId: string | null | undefined,
) {
  return useQuery<BalanceResult>({
    queryKey: ['balances', householdId, cycleId],
    enabled: !!householdId && !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_splits')
        .select('member_id, amount_owed, expense:expenses!inner(paid_by_member_id, household_id, cycle_id)')
        .is('settled_at', null)
        .eq('expense.household_id', householdId!)
        .eq('expense.cycle_id', cycleId!);
      if (error) throw error;

      const rows = (data ?? []) as unknown as UnsettledSplitRow[];
      const flat = rows
        .filter((r) => r.expense)
        .map((r) => ({
          member_id: r.member_id,
          amount_owed: Number(r.amount_owed),
          paid_by_member_id: r.expense!.paid_by_member_id,
        }));

      const rawDebts: Debt[] = flat
        .filter((r) => r.member_id !== r.paid_by_member_id)
        .map((r) => ({
          from: r.member_id,
          to: r.paid_by_member_id,
          amount: r.amount_owed,
        }));

      return {
        debts: simplifyDebts(rawDebts),
        pairwiseDebts: computePairwiseDebts(rawDebts),
        netByMember: computeNetBalances(flat),
      };
    },
  });
}

type CarryoverRow = {
  member_id: string;
  expense: { paid_by_member_id: string; cycle_id: string | null } | null;
};

export type CarryoverDebt = {
  /** True if the viewer has unsettled debt to someone from a prior cycle. */
  iOweFromPrior: boolean;
  /** True if someone else has unsettled debt to the viewer from a prior cycle. */
  owedToMeFromPrior: boolean;
};

/**
 * Detects unsettled expense_splits whose parent expense is NOT in the current
 * cycle — i.e., debts that rolled over. Returns two booleans scoped to the
 * viewer so the home screen can flag each stat card independently.
 */
export function useCarryoverDebt(
  householdId: string | null | undefined,
  currentCycleId: string | null | undefined,
  memberId: string | null | undefined,
) {
  return useQuery<CarryoverDebt>({
    queryKey: ['carryover', householdId, currentCycleId, memberId],
    enabled: !!householdId && !!currentCycleId && !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_splits')
        .select('member_id, expense:expenses!inner(paid_by_member_id, household_id, cycle_id)')
        .is('settled_at', null)
        .eq('expense.household_id', householdId!)
        .neq('expense.cycle_id', currentCycleId!);
      if (error) throw error;

      const rows = (data ?? []) as unknown as CarryoverRow[];
      let iOweFromPrior = false;
      let owedToMeFromPrior = false;
      for (const r of rows) {
        if (!r.expense) continue;
        if (r.member_id === r.expense.paid_by_member_id) continue;
        if (r.member_id === memberId) iOweFromPrior = true;
        if (r.expense.paid_by_member_id === memberId) owedToMeFromPrior = true;
        if (iOweFromPrior && owedToMeFromPrior) break;
      }
      return { iOweFromPrior, owedToMeFromPrior };
    },
  });
}

/**
 * Settlements involving the current member for the given cycle, newest first.
 * Filtered server-side via RLS + household_id; the member filter narrows to
 * payments the user either made or received.
 */
export function useMySettlements(
  householdId: string | null | undefined,
  cycleId: string | null | undefined,
  memberId: string | null | undefined,
) {
  return useQuery<SettlementWithMembers[]>({
    queryKey: ['settlements', 'mine', householdId, cycleId, memberId],
    enabled: !!householdId && !!cycleId && !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlements')
        .select(
          '*, from_member:members!settlements_from_member_id_fkey(id, display_name, color), to_member:members!settlements_to_member_id_fkey(id, display_name, color)',
        )
        .eq('household_id', householdId!)
        .eq('cycle_id', cycleId!)
        .or(`from_member_id.eq.${memberId},to_member_id.eq.${memberId}`)
        .order('settled_at', { ascending: false });
      if (error) throw error;
      return (data as SettlementWithMembers[] | null) ?? [];
    },
  });
}

export type SettlePairInput = {
  householdId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  method?: SettlementMethod;
  notes?: string;
};

export function useSettlePair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SettlePairInput) => {
      const { data, error } = await supabase.rpc('settle_pair', {
        p_household_id: input.householdId,
        p_from_member_id: input.fromMemberId,
        p_to_member_id: input.toMemberId,
        p_amount: input.amount,
        p_method: input.method ?? 'other',
        ...(input.notes ? { p_notes: input.notes } : {}),
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, input) => {
      void queryClient.invalidateQueries({ queryKey: ['balances', input.householdId] });
      void queryClient.invalidateQueries({ queryKey: ['expenses', input.householdId] });
      void queryClient.invalidateQueries({ queryKey: ['settlements', 'mine', input.householdId] });
    },
  });
}
