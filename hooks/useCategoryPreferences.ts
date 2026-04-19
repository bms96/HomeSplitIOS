import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Category = Database['public']['Enums']['expense_category'];

export type CategoryPreference = {
  household_id: string;
  category: Category;
  hidden: boolean;
  custom_label: string | null;
};

export const DEFAULT_CATEGORY_LABELS: Record<Category, string> = {
  rent: 'Rent',
  utilities: 'Utilities',
  groceries: 'Groceries',
  household: 'Household',
  food: 'Food',
  transport: 'Transport',
  other: 'Other',
};

export const ALL_CATEGORIES: Category[] = [
  'rent',
  'utilities',
  'groceries',
  'household',
  'food',
  'transport',
  'other',
];

/**
 * Categories that are hidden from the Add Expense picker by default. These
 * belong to the recurring-bills flow — users can still surface them from the
 * Household → Categories screen.
 */
export const DEFAULT_HIDDEN_CATEGORIES: Category[] = ['rent', 'utilities'];

export function useCategoryPreferences(householdId: string | null | undefined) {
  return useQuery<CategoryPreference[]>({
    queryKey: ['category_prefs', householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_category_preferences' as never)
        .select('household_id, category, hidden, custom_label')
        .eq('household_id', householdId!);
      if (error) throw error;
      return (data as CategoryPreference[] | null) ?? [];
    },
  });
}

export type CategoryDisplay = {
  value: Category;
  label: string;
  hidden: boolean;
};

export function mergeCategoryDisplay(
  prefs: CategoryPreference[] | undefined,
): CategoryDisplay[] {
  const byCat = new Map(prefs?.map((p) => [p.category, p]) ?? []);
  return ALL_CATEGORIES.map((c) => {
    const pref = byCat.get(c);
    const isDefaultHidden = DEFAULT_HIDDEN_CATEGORIES.includes(c);
    const hidden = pref ? pref.hidden : isDefaultHidden;
    const label = pref?.custom_label?.trim() || DEFAULT_CATEGORY_LABELS[c];
    return { value: c, label, hidden };
  });
}

export function labelForCategory(
  category: Category,
  prefs: CategoryPreference[] | undefined,
): string {
  const pref = prefs?.find((p) => p.category === category);
  return pref?.custom_label?.trim() || DEFAULT_CATEGORY_LABELS[category];
}

export type SaveCategoryPreferenceInput = {
  householdId: string;
  category: Category;
  hidden: boolean;
  customLabel: string | null;
};

export function useSaveCategoryPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveCategoryPreferenceInput) => {
      const { error } = await supabase
        .from('expense_category_preferences' as never)
        .upsert(
          {
            household_id: input.householdId,
            category: input.category,
            hidden: input.hidden,
            custom_label: input.customLabel,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: 'household_id,category' },
        );
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      void queryClient.invalidateQueries({
        queryKey: ['category_prefs', input.householdId],
      });
    },
  });
}
