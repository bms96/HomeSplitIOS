import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  ActivityIndicator,
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
  labelForCategory,
  mergeCategoryDisplay,
  useCategoryPreferences,
} from '@/hooks/useCategoryPreferences';
import {
  useDeleteExpense,
  useExpense,
  useUpdateExpense,
} from '@/hooks/useExpenses';
import { useCurrentHousehold, useMembers } from '@/hooks/useHousehold';
import { supabase } from '@/lib/supabase';
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
  date: z.string().min(1),
  hasDueDate: z.boolean(),
  dueDate: z.string().optional(),
  splitMemberIds: z.array(z.string().uuid()).min(1, 'Select at least one member'),
});

type FormValues = z.infer<typeof schema>;

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: membership } = useCurrentHousehold();
  const { data: members = [] } = useMembers(membership?.household_id);
  const { data: categoryPrefs } = useCategoryPreferences(membership?.household_id);
  const { data: expense, isLoading } = useExpense(id);
  const update = useUpdateExpense();
  const del = useDeleteExpense();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const anySettled = useMemo(
    () => (expense?.expense_splits ?? []).some((s) => s.settled_at != null),
    [expense],
  );

  const categoryOptions = useMemo(() => {
    const visible = mergeCategoryDisplay(categoryPrefs).filter((c) => !c.hidden);
    if (expense && !visible.some((c) => c.value === expense.category)) {
      visible.push({
        value: expense.category,
        label: labelForCategory(expense.category, categoryPrefs),
        hidden: false,
      });
    }
    return visible;
  }, [categoryPrefs, expense]);

  const isPayer = !!expense && !!membership && expense.paid_by_member_id === membership.id;
  const canEdit = isPayer && !anySettled;
  const [isEditing, setIsEditing] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const queryClient = useQueryClient();

  const initialSplitIds = useMemo(
    () => (expense?.expense_splits ?? []).map((s) => s.member_id),
    [expense],
  );

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      description: '',
      category: 'other',
      paidByMemberId: '',
      date: '',
      hasDueDate: false,
      dueDate: '',
      splitMemberIds: [],
    },
  });

  useEffect(() => {
    if (expense) {
      reset({
        amount: String(expense.amount),
        description: expense.description,
        category: expense.category,
        paidByMemberId: expense.paid_by_member_id,
        date: expense.date,
        hasDueDate: expense.due_date != null,
        dueDate: expense.due_date ?? '',
        splitMemberIds: expense.expense_splits.map((s) => s.member_id),
      });
    }
  }, [expense, reset]);

  const amountWatch = useWatch({ control, name: 'amount' });
  const splitIdsWatch = useWatch({ control, name: 'splitMemberIds' });

  const previewSplits = useMemo(() => {
    const n = parseFloat(sanitizeAmount(amountWatch ?? ''));
    if (!Number.isFinite(n) || n <= 0 || !splitIdsWatch || splitIdsWatch.length === 0) return null;
    const rounded = parseFloat(n.toFixed(2));
    const splits = calculateEqualSplits(rounded, splitIdsWatch);
    return splits.map((s) => ({
      member: members.find((m) => m.id === s.member_id),
      amount: s.amount_owed,
    }));
  }, [amountWatch, splitIdsWatch, members]);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    if (!expense) return;
    try {
      const amount = parseFloat(parseFloat(sanitizeAmount(values.amount)).toFixed(2));
      await update.mutateAsync({
        id: expense.id,
        householdId: expense.household_id,
        paidByMemberId: values.paidByMemberId,
        amount,
        description: values.description.trim(),
        category: values.category,
        date: values.date,
        dueDate: values.hasDueDate && values.dueDate ? values.dueDate : null,
        memberIds: values.splitMemberIds,
      });
      setIsEditing(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save.';
      setSubmitError(message);
      Alert.alert('Could not save', message);
    }
  };

  const handleDelete = () => {
    if (!expense) return;
    Alert.alert(
      'Delete this expense?',
      'This removes the expense and all of its splits. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await del.mutateAsync({ id: expense.id, household_id: expense.household_id });
              router.back();
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Delete failed.';
              Alert.alert('Could not delete', message);
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: true, title: 'Expense' }} />
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!expense) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: true, title: 'Expense' }} />
        <View style={styles.loading}>
          <Text style={styles.emptyTitle}>Expense not found</Text>
          <Button label="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isEditing) {
    const mySplit = membership
      ? expense.expense_splits.find((s) => s.member_id === membership.id)
      : undefined;
    const myShareUnsettled = !isPayer && !!mySplit && mySplit.settled_at == null;
    const isSelfPaid =
      isPayer &&
      expense.expense_splits.length === 1 &&
      expense.expense_splits[0]?.member_id === membership?.id;
    const myShareAmount = mySplit ? Number(mySplit.amount_owed) : 0;

    const onMarkPaid = async () => {
      if (!mySplit || markingPaid) return;
      setMarkingPaid(true);
      try {
        const { error } = await supabase
          .from('expense_splits')
          .update({ settled_at: new Date().toISOString() })
          .eq('id', mySplit.id);
        if (error) throw error;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['expense', expense.id] }),
          queryClient.invalidateQueries({ queryKey: ['expenses', expense.household_id] }),
          queryClient.invalidateQueries({ queryKey: ['balances', expense.household_id] }),
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not mark paid.';
        Alert.alert('Could not mark paid', message);
      } finally {
        setMarkingPaid(false);
      }
    };

    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Expense',
            presentation: 'modal',
            headerRight: canEdit
              ? () => (
                  <Pressable
                    onPress={() => setIsEditing(true)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Edit expense"
                  >
                    <Text style={styles.headerAction}>Edit</Text>
                  </Pressable>
                )
              : undefined,
          }}
        />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.readCard}>
            <Text style={styles.readLabel}>Description</Text>
            <Text style={styles.readValue}>{expense.description}</Text>

            <Text style={styles.readLabel}>Amount</Text>
            <Text style={styles.readValue}>{formatUSD(Number(expense.amount))}</Text>

            <Text style={styles.readLabel}>Category</Text>
            <Text style={styles.readValue}>
              {labelForCategory(expense.category, categoryPrefs)}
            </Text>

            <Text style={styles.readLabel}>Date</Text>
            <Text style={styles.readValue}>{expense.date}</Text>

            {expense.due_date ? (
              <>
                <Text style={styles.readLabel}>Due date</Text>
                <Text style={styles.readValue}>{expense.due_date}</Text>
              </>
            ) : null}

            <Text style={styles.readLabel}>Paid by</Text>
            <Text style={styles.readValue}>
              {expense.paid_by_member?.id === membership?.id
                ? `${expense.paid_by_member?.display_name ?? 'You'} (you)`
                : expense.paid_by_member?.display_name ?? 'Unknown'}
            </Text>

            <Text style={styles.readLabel}>Split between</Text>
            {expense.expense_splits.map((s) => {
              const m = members.find((x) => x.id === s.member_id);
              const name = m?.display_name ?? 'Former member';
              const isYou = s.member_id === membership?.id;
              const isPayerSplit = s.member_id === expense.paid_by_member_id;
              const settled = s.settled_at != null || isPayerSplit;
              return (
                <View key={s.id} style={styles.splitRow}>
                  <Text style={styles.readValue}>
                    {isYou ? `${name} (you)` : name}
                  </Text>
                  <Text
                    style={[
                      styles.splitMeta,
                      settled ? styles.splitMetaPaid : styles.splitMetaUnpaid,
                    ]}
                  >
                    {formatUSD(Number(s.amount_owed))} ·{' '}
                    {settled ? 'Paid' : 'Unpaid'}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          {myShareUnsettled ? (
            isSelfPaid ? (
              <Button
                label={
                  markingPaid ? 'Marking\u2026' : `Mark ${formatUSD(myShareAmount)} paid`
                }
                onPress={onMarkPaid}
                loading={markingPaid}
              />
            ) : (
              <Button label="Go to balances" onPress={() => router.push('/settle')} />
            )
          ) : isPayer &&
            expense.expense_splits.some(
              (s) => s.member_id !== membership?.id && s.settled_at == null,
            ) ? (
            <Button label="Go to balances" onPress={() => router.push('/settle')} />
          ) : null}
          <Button label="Close" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{ headerShown: true, title: 'Edit expense', presentation: 'modal' }}
      />
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
                autoCapitalize="sentences"
                errorMessage={errors.description?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DateField
                label="Date"
                value={field.value}
                onChange={field.onChange}
                errorMessage={errors.date?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="hasDueDate"
            render={({ field }) => (
              <View style={styles.dueDateCard}>
                <View style={styles.dueDateHead}>
                  <View style={styles.dueDateTitleWrap}>
                    <Text style={styles.dueDateTitle}>Set a due date</Text>
                    <Text style={styles.dueDateHelper}>
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
                      />
                    )}
                  />
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <View style={styles.group}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.chips}>
                  {categoryOptions.map((c) => {
                    const selected = field.value === c.value;
                    return (
                      <Pressable
                        key={c.value}
                        onPress={() => field.onChange(c.value)}
                        style={[styles.chip, selected && styles.chipSelected]}
                        accessibilityRole="button"
                        accessibilityLabel={`${c.label} category`}
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
                        accessibilityLabel={`${m.display_name} paid`}
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
          ) : null}

          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={update.isPending ? 'Saving\u2026' : 'Save changes'}
            onPress={handleSubmit(onSubmit)}
            loading={update.isPending}
          />
          <Button
            label="Delete"
            variant="secondary"
            onPress={handleDelete}
            loading={del.isPending}
          />
          <Button label="Cancel" variant="secondary" onPress={() => setIsEditing(false)} />
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
  dueDateCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  dueDateHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dueDateTitleWrap: {
    flex: 1,
    gap: 2,
  },
  dueDateTitle: {
    ...Typography.callout,
    color: Colors.dark,
    fontWeight: '600',
  },
  dueDateHelper: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.title3,
    color: Colors.dark,
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
  readCard: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    gap: Spacing.xs,
  },
  readLabel: {
    ...Typography.footnote,
    color: Colors.mid,
    marginTop: Spacing.xs,
  },
  readValue: {
    ...Typography.body,
    color: Colors.dark,
    fontWeight: '600',
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
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  splitMeta: {
    ...Typography.footnote,
    fontWeight: '600',
  },
  splitMetaPaid: {
    color: Colors.primary,
  },
  splitMetaUnpaid: {
    color: Colors.mid,
  },
  headerAction: {
    ...Typography.callout,
    color: Colors.primary,
    fontWeight: '600',
    paddingHorizontal: Spacing.xs,
  },
});
