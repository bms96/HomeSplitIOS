import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { TextField } from '@/components/ui/TextField';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import {
  mergeCategoryDisplay,
  useCategoryPreferences,
} from '@/hooks/useCategoryPreferences';
import { useAddExpense, useCurrentCycle } from '@/hooks/useExpenses';
import { useCurrentHousehold, useMembers } from '@/hooks/useHousehold';
import { formatUSD } from '@/utils/currency';
import { calculateEqualSplits } from '@/utils/splits';

function sanitizeAmount(v: string): string {
  return v.replace(/[$,\s]/g, '');
}

const schema = z.object({
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine(
      (v) => {
        const n = parseFloat(sanitizeAmount(v));
        return !Number.isNaN(n) && n > 0;
      },
      'Must be a positive number',
    ),
  description: z.string().min(1, 'Description is required').max(100),
  category: z.enum(['rent', 'utilities', 'groceries', 'household', 'food', 'transport', 'other']),
  paidByMemberId: z.string().uuid(),
  splitMemberIds: z.array(z.string().uuid()).min(1, 'Select at least one member'),
  hasDueDate: z.boolean(),
  dueDate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function AddExpenseScreen() {
  const { data: membership } = useCurrentHousehold();
  const householdId = membership?.household_id;
  const { data: cycle } = useCurrentCycle(householdId);
  const { data: members = [] } = useMembers(householdId);
  const { data: categoryPrefs } = useCategoryPreferences(householdId);
  const addExpense = useAddExpense();

  const visibleCategories = useMemo(
    () => mergeCategoryDisplay(categoryPrefs).filter((c) => !c.hidden),
    [categoryPrefs],
  );
  const fallbackCategory = visibleCategories.find((c) => c.value === 'other')?.value
    ?? visibleCategories[0]?.value
    ?? 'other';
  const [submitError, setSubmitError] = useState<string | null>(null);

  const allMemberIds = useMemo(() => members.map((m) => m.id), [members]);

  const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      description: '',
      category: 'other',
      paidByMemberId: membership?.id ?? '',
      splitMemberIds: allMemberIds,
      hasDueDate: false,
      dueDate: '',
    },
  });

  useEffect(() => {
    if (members.length > 0 && membership?.id) {
      reset((prev) => ({
        ...prev,
        paidByMemberId: prev.paidByMemberId || membership.id,
        splitMemberIds: prev.splitMemberIds.length ? prev.splitMemberIds : allMemberIds,
      }));
    }
  }, [members, membership, allMemberIds, reset]);

  const categoryWatch = useWatch({ control, name: 'category' });

  useEffect(() => {
    if (visibleCategories.length === 0) return;
    const stillVisible = visibleCategories.some((c) => c.value === categoryWatch);
    if (!stillVisible) setValue('category', fallbackCategory);
  }, [visibleCategories, categoryWatch, fallbackCategory, setValue]);

  const amountWatch = useWatch({ control, name: 'amount' });
  const splitIdsWatch = useWatch({ control, name: 'splitMemberIds' });
  const [splitAll, setSplitAll] = useState(true);

  useEffect(() => {
    if (splitAll && allMemberIds.length > 0) {
      setValue('splitMemberIds', allMemberIds, { shouldValidate: true });
    }
  }, [splitAll, allMemberIds, setValue]);

  const previewSplits = useMemo(() => {
    const n = parseFloat(sanitizeAmount(amountWatch ?? ''));
    if (!Number.isFinite(n) || n <= 0 || !splitIdsWatch?.length) return null;
    const rounded = parseFloat(n.toFixed(2));
    const splits = calculateEqualSplits(rounded, splitIdsWatch);
    return splits.map((s) => ({
      member: members.find((m) => m.id === s.member_id),
      amount: s.amount_owed,
    }));
  }, [amountWatch, splitIdsWatch, members]);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    if (!householdId || !cycle) {
      setSubmitError('No open billing cycle.');
      return;
    }
    if (members.length === 0) {
      setSubmitError('No household members to split between.');
      return;
    }
    try {
      const amount = parseFloat(parseFloat(sanitizeAmount(values.amount)).toFixed(2));
      await addExpense.mutateAsync({
        householdId,
        cycleId: cycle.id,
        paidByMemberId: values.paidByMemberId,
        amount,
        description: values.description.trim(),
        category: values.category,
        memberIds: values.splitMemberIds,
        dueDate: values.hasDueDate && values.dueDate ? values.dueDate : null,
      });
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add expense.';
      setSubmitError(message);
      Alert.alert('Could not add expense', message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Add expense', presentation: 'modal' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <TextField
                label="Amount"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="decimal-pad"
                placeholder="0.00"
                errorMessage={errors.amount?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <TextField
                label="Description"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Groceries at Whole Foods"
                autoCapitalize="sentences"
                errorMessage={errors.description?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <View style={styles.group}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.chips}>
                  {visibleCategories.map((c) => {
                    const selected = field.value === c.value;
                    return (
                      <Pressable
                        key={c.value}
                        onPress={() => field.onChange(c.value)}
                        style={[styles.chip, selected && styles.chipSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                          {c.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          />

          <Controller
            control={control}
            name="paidByMemberId"
            render={({ field }) => (
              <View style={styles.group}>
                <Text style={styles.label}>Paid by</Text>
                <View style={styles.chips}>
                  {members.map((m) => {
                    const selected = field.value === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => field.onChange(m.id)}
                        style={[styles.chip, selected && styles.chipSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                          {m.id === membership?.id ? `${m.display_name} (you)` : m.display_name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          />

          <View style={styles.group}>
            <View style={styles.splitAllRow}>
              <View style={styles.recurringTitleWrap}>
                <Text style={styles.recurringTitle}>Split between everyone</Text>
                <Text style={styles.helper}>
                  Uncheck to exclude specific roommates from this expense.
                </Text>
              </View>
              <Switch
                value={splitAll}
                onValueChange={setSplitAll}
                accessibilityLabel="Split between everyone"
              />
            </View>

            {!splitAll ? (
              <Controller
                control={control}
                name="splitMemberIds"
                render={({ field }) => (
                  <View style={styles.group}>
                    <Text style={styles.label}>Split between</Text>
                    <View style={styles.chips}>
                      {members.map((m) => {
                        const selected = field.value.includes(m.id);
                        return (
                          <Pressable
                            key={m.id}
                            onPress={() => {
                              field.onChange(
                                selected
                                  ? field.value.filter((x) => x !== m.id)
                                  : [...field.value, m.id],
                              );
                            }}
                            style={[styles.chip, selected && styles.chipSelected]}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected }}
                            accessibilityLabel={m.display_name}
                          >
                            <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                              {m.id === membership?.id ? `${m.display_name} (you)` : m.display_name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {errors.splitMemberIds ? (
                      <Text style={styles.error}>{errors.splitMemberIds.message}</Text>
                    ) : null}
                  </View>
                )}
              />
            ) : null}
          </View>

          {previewSplits ? (
            <View style={styles.previewCard}>
              {previewSplits.map(({ member, amount }, i) => (
                <View key={member?.id ?? i} style={styles.previewRow}>
                  <Text style={styles.previewName} numberOfLines={1}>
                    {member?.id === membership?.id
                      ? `${member?.display_name} (you)`
                      : member?.display_name ?? 'Unknown'}
                  </Text>
                  <Text style={styles.previewAmount}>{formatUSD(amount)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.helper}>Enter an amount to see each share.</Text>
          )}

          <Controller
            control={control}
            name="hasDueDate"
            render={({ field }) => (
              <View style={styles.recurringCard}>
                <View style={styles.recurringHead}>
                  <View style={styles.recurringTitleWrap}>
                    <Text style={styles.recurringTitle}>Set a due date</Text>
                    <Text style={styles.helper}>
                      Show this expense on the dashboard as it approaches its due date.
                    </Text>
                  </View>
                  <Switch
                    value={field.value}
                    onValueChange={field.onChange}
                    accessibilityLabel="Set a due date"
                  />
                </View>
                {field.value ? (
                  <Controller
                    control={control}
                    name="dueDate"
                    render={({ field: dueField }) => (
                      <DateField
                        label="Due date"
                        value={dueField.value ?? ''}
                        onChange={dueField.onChange}
                        minimumDate={new Date()}
                      />
                    )}
                  />
                ) : null}
              </View>
            )}
          />

          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={addExpense.isPending ? 'Adding\u2026' : 'Add expense'}
            onPress={handleSubmit(onSubmit)}
            loading={addExpense.isPending}
            disabled={!cycle}
          />
          <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  group: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.subhead,
    color: Colors.mid,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light,
    backgroundColor: Colors.white,
  },
  chipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  chipLabel: {
    ...Typography.subhead,
    color: Colors.mid,
  },
  chipLabelSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  helper: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  previewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  previewName: {
    ...Typography.callout,
    color: Colors.dark,
    flex: 1,
    marginRight: Spacing.sm,
  },
  previewAmount: {
    ...Typography.callout,
    color: Colors.dark,
    fontWeight: '600',
  },
  recurringCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  recurringHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  recurringTitleWrap: {
    flex: 1,
    gap: 2,
  },
  recurringTitle: {
    ...Typography.callout,
    color: Colors.dark,
    fontWeight: '600',
  },
  splitAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
  },
  error: {
    ...Typography.footnote,
    color: Colors.danger,
  },
  footer: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
});
