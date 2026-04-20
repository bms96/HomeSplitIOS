import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { calculateEqualSplits, type Split } from '@/utils/splits';

type Expense = Database['public']['Tables']['expenses']['Row'];
type ExpenseSplit = Database['public']['Tables']['expense_splits']['Row'];
type Member = Database['public']['Tables']['members']['Row'];
type BillingCycle = Database['public']['Tables']['billing_cycles']['Row'];
type ExpenseCategory = Database['public']['Enums']['expense_category'];

export type ExpenseWithDetails = Expense & {
  paid_by_member: Pick<Member, 'id' | 'display_name' | 'color'> | null;
  expense_splits: ExpenseSplit[];
};

/**
 * Returns the currently-open billing cycle for a household, or null if none.
 * The bootstrap cycle is created alongside the household by the create_household RPC.
 */
export function useCurrentCycle(householdId: string | null | undefined) {
  return useQuery<BillingCycle | null>({
    queryKey: ['cycle', 'current', householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_cycles')
        .select('*')
        .eq('household_id', householdId!)
        .is('closed_at', null)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useExpenses(
  householdId: string | null | undefined,
  cycleId: string | null | undefined,
) {
  return useQuery<ExpenseWithDetails[]>({
    queryKey: ['expenses', householdId, cycleId],
    enabled: !!householdId && !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, paid_by_member:members!expenses_paid_by_member_id_fkey(id, display_name, color), expense_splits(*)')
        .eq('household_id', householdId!)
        .eq('cycle_id', cycleId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as ExpenseWithDetails[] | null) ?? [];
    },
  });
}

export function useExpense(id: string | null | undefined) {
  return useQuery<ExpenseWithDetails | null>({
    queryKey: ['expense', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, paid_by_member:members!expenses_paid_by_member_id_fkey(id, display_name, color), expense_splits(*)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return (data as ExpenseWithDetails | null) ?? null;
    },
  });
}

export type AddExpenseInput = {
  householdId: string;
  cycleId: string;
  paidByMemberId: string;
  amount: number;
  description: string;
  category: ExpenseCategory;
  date?: string;
  dueDate?: string | null;
  memberIds: string[];
};

export function useAddExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddExpenseInput) => {
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          household_id: input.householdId,
          cycle_id: input.cycleId,
          paid_by_member_id: input.paidByMemberId,
          amount: input.amount,
          description: input.description,
          category: input.category,
          ...(input.date ? { date: input.date } : {}),
          ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
        })
        .select()
        .single();
      if (expenseError) throw expenseError;

      const splits: Split[] = calculateEqualSplits(input.amount, input.memberIds);
      const { error: splitError } = await supabase
        .from('expense_splits')
        .insert(
          splits.map((s) => ({
            expense_id: expense.id,
            member_id: s.member_id,
            amount_owed: s.amount_owed,
          })),
        );
      if (splitError) throw splitError;
      return expense as Expense;
    },
    onSuccess: (expense) => {
      void queryClient.invalidateQueries({ queryKey: ['expenses', expense.household_id] });
      void queryClient.invalidateQueries({ queryKey: ['balances', expense.household_id] });
    },
  });
}

export type UpdateExpenseInput = {
  id: string;
  householdId: string;
  paidByMemberId: string;
  amount: number;
  description: string;
  category: ExpenseCategory;
  date: string;
  dueDate?: string | null;
  memberIds: string[];
};

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateExpenseInput) => {
      const { data: expense, error: updateError } = await supabase
        .from('expenses')
        .update({
          paid_by_member_id: input.paidByMemberId,
          amount: input.amount,
          description: input.description,
          category: input.category,
          date: input.date,
          ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
        })
        .eq('id', input.id)
        .select()
        .single();
      if (updateError) throw updateError;

      const { error: deleteError } = await supabase
        .from('expense_splits')
        .delete()
        .eq('expense_id', input.id)
        .is('settled_at', null);
      if (deleteError) throw deleteError;

      const splits: Split[] = calculateEqualSplits(input.amount, input.memberIds);
      const { error: insertError } = await supabase
        .from('expense_splits')
        .insert(
          splits.map((s) => ({
            expense_id: input.id,
            member_id: s.member_id,
            amount_owed: s.amount_owed,
          })),
        );
      if (insertError) throw insertError;
      return expense as Expense;
    },
    onSuccess: (expense) => {
      void queryClient.invalidateQueries({ queryKey: ['expenses', expense.household_id] });
      void queryClient.invalidateQueries({ queryKey: ['expense', expense.id] });
      void queryClient.invalidateQueries({ queryKey: ['balances', expense.household_id] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expense: Pick<Expense, 'id' | 'household_id'>) => {
      const { error } = await supabase.from('expenses').delete().eq('id', expense.id);
      if (error) throw error;
      return expense;
    },
    onSuccess: (expense) => {
      void queryClient.invalidateQueries({ queryKey: ['expenses', expense.household_id] });
      void queryClient.invalidateQueries({ queryKey: ['balances', expense.household_id] });
    },
  });
}
