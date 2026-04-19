import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useDevStore } from '@/stores/devStore';
import type { Database } from '@/types/database';

type Household = Database['public']['Tables']['households']['Row'];
type Member = Database['public']['Tables']['members']['Row'];

type CurrentHousehold = Member & { household: Household };

/**
 * Returns the current user's primary household (first active membership).
 * MVP assumes single-household per user; expand when multi-household ships.
 */
export function useCurrentHousehold() {
  const { user } = useAuth();
  const impersonatedMemberId = useDevStore((s) => s.impersonatedMemberId);
  const override = __DEV__ ? impersonatedMemberId : null;
  return useQuery<CurrentHousehold | null>({
    queryKey: ['household', 'current', user?.id, override],
    enabled: !!user?.id,
    queryFn: async () => {
      if (override) {
        const { data, error } = await supabase
          .from('members')
          .select('*, household:households(*)')
          .eq('id', override)
          .is('left_at', null)
          .maybeSingle();
        if (error) throw error;
        if (data) return data as CurrentHousehold;
      }
      const { data, error } = await supabase
        .from('members')
        .select('*, household:households(*)')
        .eq('user_id', user!.id)
        .is('left_at', null)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as CurrentHousehold | null) ?? null;
    },
  });
}

export function useMembers(householdId: string | null | undefined) {
  return useQuery<Member[]>({
    queryKey: ['members', householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('household_id', householdId!)
        .is('left_at', null)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

type CreateHouseholdInput = {
  name: string;
  displayName: string;
  timezone?: string;
  cycleStartDay?: number;
};

export function useCreateHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateHouseholdInput) => {
      const { data, error } = await supabase.rpc('create_household', {
        p_name: input.name,
        p_display_name: input.displayName,
        p_timezone: input.timezone ?? 'America/New_York',
        p_cycle_start_day: input.cycleStartDay ?? 1,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['household'] });
    },
  });
}

export function useRotateInviteToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (householdId: string) => {
      const { data, error } = await supabase.rpc('rotate_invite_token', {
        hid: householdId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['household'] });
    },
  });
}

export function useUpdateHouseholdName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { householdId: string; name: string }) => {
      const { error } = await supabase
        .from('households')
        .update({ name: input.name })
        .eq('id', input.householdId);
      if (error) throw error;
      return input;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['household'] });
    },
  });
}

export function useUpdateMemberDisplayName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { memberId: string; displayName: string }) => {
      const { error } = await supabase
        .from('members')
        .update({ display_name: input.displayName })
        .eq('id', input.memberId);
      if (error) throw error;
      return input;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['household'] });
      void queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });
}

export function useJoinHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('join_household_by_token', {
        token,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['household'] });
      void queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });
}
