import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type CompleteMoveOutInput = {
  householdId: string;
  memberId: string;
  moveOutDate: string; // YYYY-MM-DD
};

export function useCompleteMoveOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CompleteMoveOutInput) => {
      const { data, error } = await supabase.rpc('complete_move_out', {
        p_household_id: input.householdId,
        p_member_id: input.memberId,
        p_move_out_date: input.moveOutDate,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, input) => {
      void queryClient.invalidateQueries({ queryKey: ['household'] });
      void queryClient.invalidateQueries({ queryKey: ['members', input.householdId] });
      void queryClient.invalidateQueries({ queryKey: ['expenses', input.householdId] });
      void queryClient.invalidateQueries({ queryKey: ['balances', input.householdId] });
    },
  });
}
