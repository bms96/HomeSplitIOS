import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { useCurrentHousehold, useMembers } from '@/hooks/useHousehold';
import {
  getExcludedMemberIds,
  getShares,
  useBillCycleAmounts,
  useBillCyclePayments,
  useDeleteRecurringBill,
  useRecurringBill,
  useSaveRecurringBill,
  useSetBillCycleAmount,
  useToggleBillPayment,
} from '@/hooks/useRecurringBills';
import { useCurrentCycle } from '@/hooks/useExpenses';
import { formatFrequency } from '@/utils/billFrequency';
import { formatUSD } from '@/utils/currency';
import { sumShares, type Share } from '@/utils/splits';
import type { Database } from '@/types/database';

type Frequency = Database['public']['Enums']['bill_cycle_frequency'];
type SplitType = Database['public']['Enums']['split_type'];

const SPLIT_TYPES: { value: SplitType; label: string }[] = [
  { value: 'equal', label: 'Equal' },
  { value: 'custom_amt', label: 'Exact $' },
];

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'monthly_first', label: '1st of month' },
  { value: 'monthly_last', label: 'Last of month' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const shareSchema = z.object({
  member_id: z.string().uuid(),
  value: z.number(),
});

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(60),
  amount: z
    .string()
    .refine(
      (v) => v.trim() === '' || (!Number.isNaN(parseFloat(v)) && parseFloat(v) > 0),
      'Leave blank for variable, or enter a positive number',
    ),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'monthly_first', 'monthly_last']),
  nextDueDate: z.string().regex(DATE_RE, 'Use format YYYY-MM-DD'),
  active: z.boolean(),
  splitType: z.enum(['equal', 'custom_pct', 'custom_amt']),
  includedMemberIds: z.array(z.string().uuid()).min(1, 'Select at least one member'),
  shares: z.array(shareSchema),
});

type FormValues = z.infer<typeof schema>;

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function firstOfNextMonthIso(): string {
  const now = new Date();
  const nextMonth = now.getMonth() + 1;
  const targetYear = now.getFullYear() + Math.floor(nextMonth / 12);
  const targetMonth = nextMonth % 12;
  const mm = String(targetMonth + 1).padStart(2, '0');
  return `${targetYear}-${mm}-01`;
}

function lastOfCurrentMonthIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

const DAY_CHIPS: { idx: number; label: string }[] = [
  { idx: 0, label: 'Sun' },
  { idx: 1, label: 'Mon' },
  { idx: 2, label: 'Tue' },
  { idx: 3, label: 'Wed' },
  { idx: 4, label: 'Thu' },
  { idx: 5, label: 'Fri' },
  { idx: 6, label: 'Sat' },
];

function evenAmtShares(ids: string[], total: number): Share[] {
  const base = parseFloat((total / ids.length).toFixed(2));
  const remainder = parseFloat((total - base * ids.length).toFixed(2));
  return ids.map((id, i) => ({
    member_id: id,
    value: i === 0 ? parseFloat((base + remainder).toFixed(2)) : base,
  }));
}

function getDayIdxFromIso(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return new Date().getDay();
  return new Date(y, m - 1, d).getDay();
}

function nextOccurrenceOfDayIso(targetDayIdx: number): string {
  const now = new Date();
  const delta = (targetDayIdx - now.getDay() + 7) % 7;
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta);
  const y = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

export default function BillFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const billId = isNew ? undefined : id;

  const { data: membership } = useCurrentHousehold();
  const householdId = membership?.household_id;
  const { data: members = [] } = useMembers(householdId);

  const { data: bill, isLoading: loadingBill } = useRecurringBill(billId);
  const { data: cycle } = useCurrentCycle(householdId);
  const { data: cyclePayments = [] } = useBillCyclePayments(householdId, cycle?.id);
  const { data: cycleAmounts = [] } = useBillCycleAmounts(householdId, cycle?.id);
  const save = useSaveRecurringBill();
  const del = useDeleteRecurringBill();
  const togglePayment = useToggleBillPayment();
  const setCycleAmount = useSetBillCycleAmount();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [togglingMemberId, setTogglingMemberId] = useState<string | null>(null);
  const [cycleAmountInput, setCycleAmountInput] = useState('');
  const [editingCycleAmount, setEditingCycleAmount] = useState(false);

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      amount: '',
      frequency: 'monthly',
      nextDueDate: todayIso(),
      active: true,
      splitType: 'equal' as SplitType,
      includedMemberIds: [],
      shares: [] as Share[],
    },
  });

  useEffect(() => {
    if (bill) {
      const excluded = new Set(getExcludedMemberIds(bill.custom_splits));
      const savedShares = getShares(bill.custom_splits);
      reset({
        name: bill.name,
        amount: bill.amount == null ? '' : String(bill.amount),
        frequency: bill.frequency,
        nextDueDate: bill.next_due_date,
        active: bill.active,
        splitType: bill.split_type,
        includedMemberIds: members.filter((m) => !excluded.has(m.id)).map((m) => m.id),
        shares: savedShares,
      });
    } else if (isNew && members.length > 0) {
      reset((prev) => ({
        ...prev,
        includedMemberIds: prev.includedMemberIds.length
          ? prev.includedMemberIds
          : members.map((m) => m.id),
      }));
    }
  }, [bill, members, isNew, reset]);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    if (!householdId) {
      setSubmitError('No household.');
      return;
    }
    try {
      const amount =
        values.amount.trim() === ''
          ? null
          : parseFloat(parseFloat(values.amount).toFixed(2));
      const excludedMemberIds = members
        .filter((m) => !values.includedMemberIds.includes(m.id))
        .map((m) => m.id);
      const shares =
        values.splitType !== 'equal'
          ? values.shares.filter((s) => values.includedMemberIds.includes(s.member_id))
          : undefined;
      await save.mutateAsync({
        ...(billId ? { id: billId } : {}),
        householdId,
        name: values.name.trim(),
        amount,
        frequency: values.frequency,
        nextDueDate: values.nextDueDate,
        active: values.active,
        splitType: values.splitType,
        excludedMemberIds,
        shares,
      });
      if (isNew) {
        router.back();
      } else {
        setIsEditing(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save.';
      setSubmitError(message);
      Alert.alert('Could not save', message);
    }
  };

  const handleDelete = () => {
    if (!bill) return;
    Alert.alert(
      'Delete this bill?',
      'It will stop tracking payments. Past cycles are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await del.mutateAsync({ id: bill.id, household_id: bill.household_id });
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

  const [isEditing, setIsEditing] = useState(isNew);

  // Gate edits: if any still-active member has marked this cycle paid, the
  // bill is locked. Payments from moved-out members don't count — useMembers
  // already filters to left_at IS NULL, so membership in that set is the check.
  const activeMemberIds = new Set(members.map((m) => m.id));
  const isLocked =
    !!bill &&
    cyclePayments.some(
      (p) => p.bill_id === bill.id && activeMemberIds.has(p.member_id),
    );

  if (!isNew && loadingBill) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isEditing && bill) {
    const excluded = new Set(getExcludedMemberIds(bill.custom_splits));
    const included = members.filter((m) => !excluded.has(m.id));
    const freqLabel =
      FREQUENCIES.find((f) => f.value === bill.frequency)?.label ?? bill.frequency;

    const cycleOverride = cycleAmounts.find((a) => a.bill_id === bill.id);
    const effectiveAmount: number | null =
      cycleOverride != null
        ? Number(cycleOverride.amount)
        : bill.amount != null
          ? Number(bill.amount)
          : null;
    const isVariable = bill.amount == null;
    const needsAmount = effectiveAmount == null;

    const amountLabel = isVariable
      ? effectiveAmount != null
        ? `$${effectiveAmount.toFixed(2)} this cycle (variable)`
        : "Variable (set this cycle's amount)"
      : `$${effectiveAmount!.toFixed(2)}`;
    const savedShares = getShares(bill.custom_splits);
    const shareByMember = new Map<string, number>();
    if (effectiveAmount != null && included.length > 0) {
      if (bill.split_type === 'custom_pct' && savedShares.length > 0) {
        for (const s of savedShares) {
          shareByMember.set(
            s.member_id,
            parseFloat(((effectiveAmount * s.value) / 100).toFixed(2)),
          );
        }
      } else if (bill.split_type === 'custom_amt' && savedShares.length > 0) {
        for (const s of savedShares) {
          shareByMember.set(s.member_id, parseFloat(s.value.toFixed(2)));
        }
      } else {
        const perPerson = effectiveAmount / included.length;
        for (const m of included) {
          shareByMember.set(m.id, parseFloat(perPerson.toFixed(2)));
        }
      }
    }

    const paidByMember = new Map<string, { paymentId: string }>();
    for (const p of cyclePayments) {
      if (p.bill_id === bill.id) paidByMember.set(p.member_id, { paymentId: p.id });
    }
    const paidCount = included.reduce(
      (acc, m) => acc + (paidByMember.has(m.id) ? 1 : 0),
      0,
    );

    const onSaveCycleAmount = async () => {
      if (!cycle) return;
      const parsed = parseFloat(cycleAmountInput);
      if (Number.isNaN(parsed) || parsed <= 0) {
        Alert.alert('Enter an amount', "Enter a positive number for this cycle's amount.");
        return;
      }
      try {
        await setCycleAmount.mutateAsync({
          billId: bill.id,
          householdId: bill.household_id,
          cycleId: cycle.id,
          amount: parseFloat(parsed.toFixed(2)),
        });
        setEditingCycleAmount(false);
        setCycleAmountInput('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not save amount.';
        Alert.alert('Could not save', message);
      }
    };

    const onTogglePayment = async (memberId: string) => {
      if (!cycle || togglingMemberId) return;
      if (memberId !== membership?.id) return;
      const alreadyPaid = paidByMember.has(memberId);
      if (needsAmount && !alreadyPaid) {
        Alert.alert(
          'Add the amount first',
          "This bill is variable. Enter this cycle's amount above before marking your share paid.",
        );
        return;
      }
      // If this insert will complete the cycle, the server-side trigger
      // (migration 014/015) advances the bill and clears payments. Mirror
      // that by sending the user back to the dashboard so they don't sit
      // on a now-reset bill screen.
      const willCompleteCycle =
        !alreadyPaid && included.length > 0 && paidCount + 1 >= included.length;
      setTogglingMemberId(memberId);
      try {
        await togglePayment.mutateAsync({
          billId: bill.id,
          householdId: bill.household_id,
          cycleId: cycle.id,
          memberId,
          existingId: paidByMember.get(memberId)?.paymentId ?? null,
        });
        if (willCompleteCycle) {
          // Guard the modal dismissal: from the bills tab the screen isn't
          // in a dismissible modal stack, and dismissAll throws in that case.
          if (router.canDismiss()) {
            router.dismissAll();
          }
          router.replace('/');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not update.';
        Alert.alert('Could not update', message);
      } finally {
        setTogglingMemberId(null);
      }
    };

    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Bill',
            presentation: 'modal',
            headerRight: () =>
              isLocked ? null : (
                <Pressable
                  onPress={() => setIsEditing(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Edit bill"
                >
                  <Text style={styles.headerAction}>Edit</Text>
                </Pressable>
              ),
          }}
        />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.readCard}>
            <Text style={styles.readLabel}>Name</Text>
            <Text style={styles.readValue}>{bill.name}</Text>

            <Text style={styles.readLabel}>Amount</Text>
            <Text style={styles.readValue}>{amountLabel}</Text>

            <Text style={styles.readLabel}>Frequency</Text>
            <Text style={styles.readValue}>{freqLabel}</Text>

            <Text style={styles.readLabel}>Due date</Text>
            <Text style={styles.readValue}>
              {bill.frequency === 'weekly' || bill.frequency === 'biweekly'
                ? formatFrequency(bill.frequency, bill.next_due_date)
                : bill.next_due_date}
            </Text>

            <Text style={styles.readLabel}>Split method</Text>
            <Text style={styles.readValue}>
              {bill.split_type === 'custom_pct'
                ? 'Percentage'
                : bill.split_type === 'custom_amt'
                  ? 'Exact amounts'
                  : 'Equal'}
            </Text>

            <Text style={styles.readLabel}>Status</Text>
            <Text style={styles.readValue}>{bill.active ? 'Active' : 'Paused'}</Text>
          </View>

          {isLocked ? (
            <View style={styles.lockedNote}>
              <Text style={styles.lockedNoteText}>
                Locked for this cycle — someone has marked it paid. Edits unlock
                next cycle.
              </Text>
            </View>
          ) : null}

          {cycle ? (() => {
            const iPaid =
              !!membership?.id && paidByMember.has(membership.id);
            const allPaid = included.length > 0 && paidCount === included.length;
            const othersRemaining = Math.max(0, included.length - paidCount - (iPaid ? 0 : 1));
            return (
            <View style={styles.paymentsCard}>
              <View style={styles.paymentsHead}>
                <Text style={styles.paymentsTitle}>This cycle</Text>
                <Text style={styles.paymentsMeta}>
                  {paidCount} of {included.length} paid
                </Text>
              </View>
              {iPaid ? (
                <View
                  style={[
                    styles.statusBanner,
                    allPaid ? styles.statusBannerSuccess : styles.statusBannerWaiting,
                  ]}
                  accessibilityLabel={
                    allPaid
                      ? 'All roommates have paid this cycle'
                      : `You have paid. Waiting on ${othersRemaining} other${othersRemaining === 1 ? '' : 's'}.`
                  }
                >
                  <Text
                    style={[
                      styles.statusBannerText,
                      allPaid ? styles.statusBannerTextSuccess : styles.statusBannerTextWaiting,
                    ]}
                  >
                    {allPaid
                      ? '✓ All paid this cycle'
                      : `✓ You paid · waiting on ${othersRemaining} other${othersRemaining === 1 ? '' : 's'}`}
                  </Text>
                </View>
              ) : null}
              {isVariable ? (
                editingCycleAmount || needsAmount ? (
                  <View style={styles.cycleAmountEdit}>
                    <TextField
                      label="This cycle's amount"
                      value={cycleAmountInput}
                      onChangeText={setCycleAmountInput}
                      keyboardType="decimal-pad"
                      placeholder="47.00"
                    />
                    <View style={styles.cycleAmountActions}>
                      <Button
                        label={setCycleAmount.isPending ? 'Saving\u2026' : 'Save amount'}
                        onPress={onSaveCycleAmount}
                        loading={setCycleAmount.isPending}
                      />
                      {cycleOverride != null ? (
                        <Button
                          label="Cancel"
                          variant="secondary"
                          onPress={() => {
                            setEditingCycleAmount(false);
                            setCycleAmountInput('');
                          }}
                        />
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <View style={styles.cycleAmountRow}>
                    <Text style={styles.cycleAmountValue}>
                      {formatUSD(effectiveAmount!)} this cycle
                    </Text>
                    <Pressable
                      onPress={() => {
                        setCycleAmountInput(effectiveAmount!.toFixed(2));
                        setEditingCycleAmount(true);
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Edit this cycle's amount"
                    >
                      <Text style={styles.headerAction}>Edit</Text>
                    </Pressable>
                  </View>
                )
              ) : null}
              <Text style={styles.helper}>
                {needsAmount
                  ? "Variable bill — enter this cycle's amount before anyone can mark paid."
                  : "Tap your row when you've paid your share. Roommates tap their own."}
              </Text>
              {included.length === 0 ? (
                <Text style={styles.helper}>No members included.</Text>
              ) : (
                included.map((m) => {
                  const isMe = m.id === membership?.id;
                  const paid = paidByMember.has(m.id);
                  const isToggling = togglingMemberId === m.id;
                  const markBlocked = needsAmount && !paid;
                  const rowDisabled = !isMe || togglingMemberId !== null || markBlocked;
                  const badgeText = paid
                    ? 'Paid'
                    : isMe
                      ? needsAmount
                        ? 'Add amount first'
                        : 'Tap to mark paid'
                      : needsAmount
                        ? 'Amount not set'
                        : 'Unpaid';
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => onTogglePayment(m.id)}
                      disabled={rowDisabled}
                      style={({ pressed }) => [
                        styles.memberRow,
                        paid && styles.memberRowPaid,
                        pressed && isMe && !markBlocked && styles.pressed,
                      ]}
                      accessibilityRole={isMe ? 'checkbox' : undefined}
                      accessibilityState={
                        isMe ? { checked: paid, disabled: markBlocked } : undefined
                      }
                      accessibilityLabel={
                        isMe
                          ? markBlocked
                            ? `Cannot mark ${bill.name} paid — enter this cycle's amount first`
                            : `${paid ? 'Unmark' : 'Mark'} your share of ${bill.name} as paid`
                          : `${m.display_name}: ${paid ? 'paid' : needsAmount ? 'amount not set' : 'not paid'}`
                      }
                    >
                      <View style={styles.memberRowBody}>
                        <Text style={styles.memberName}>
                          {isMe ? `${m.display_name} (you)` : m.display_name}
                        </Text>
                        {shareByMember.has(m.id) ? (
                          <Text style={styles.memberMeta}>
                            Share · {formatUSD(shareByMember.get(m.id)!)}
                          </Text>
                        ) : null}
                      </View>
                      {isToggling ? (
                        <ActivityIndicator color={Colors.primary} size="small" />
                      ) : (
                        <Text
                          style={[
                            styles.paidBadge,
                            paid ? styles.paidBadgePaid : styles.paidBadgeUnpaid,
                          ]}
                        >
                          {badgeText}
                        </Text>
                      )}
                    </Pressable>
                  );
                })
              )}
            </View>
            );
          })() : null}
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Close" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: isNew ? 'Add bill' : 'Edit bill',
          presentation: 'modal',
        }}
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
            name="name"
            render={({ field }) => (
              <TextField
                label="Name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Rent, Internet, PG&E"
                autoCapitalize="words"
                errorMessage={errors.name?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <TextField
                label="Amount (leave blank for variable)"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="decimal-pad"
                placeholder="1500.00"
                errorMessage={errors.amount?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="frequency"
            render={({ field }) => (
              <View style={styles.group}>
                <Text style={styles.label}>Frequency</Text>
                <View style={styles.chips}>
                  {FREQUENCIES.map((f) => {
                    const selected = field.value === f.value;
                    return (
                      <Pressable
                        key={f.value}
                        onPress={() => {
                          field.onChange(f.value);
                          // Anchored variants pin the date — compute and lock it
                          // so users can't get into a mismatched state.
                          if (f.value === 'monthly_first') {
                            setValue('nextDueDate', firstOfNextMonthIso(), {
                              shouldValidate: true,
                            });
                          } else if (f.value === 'monthly_last') {
                            setValue('nextDueDate', lastOfCurrentMonthIso(), {
                              shouldValidate: true,
                            });
                          }
                        }}
                        style={[styles.chip, selected && styles.chipSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[styles.chipLabel, selected && styles.chipLabelSelected]}
                        >
                          {f.label}
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
            name="nextDueDate"
            render={({ field }) => {
              const freq = watch('frequency');
              if (freq === 'weekly' || freq === 'biweekly') {
                const currentDay = getDayIdxFromIso(field.value);
                return (
                  <View style={styles.group}>
                    <Text style={styles.label}>Day of week</Text>
                    <View style={styles.chips}>
                      {DAY_CHIPS.map((chip) => {
                        const selected = currentDay === chip.idx;
                        return (
                          <Pressable
                            key={chip.idx}
                            onPress={() => field.onChange(nextOccurrenceOfDayIso(chip.idx))}
                            style={[styles.chip, selected && styles.chipSelected]}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                          >
                            <Text
                              style={[styles.chipLabel, selected && styles.chipLabelSelected]}
                            >
                              {chip.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {errors.nextDueDate?.message ? (
                      <Text style={styles.error}>{errors.nextDueDate.message}</Text>
                    ) : null}
                  </View>
                );
              }
              const anchored = freq === 'monthly_first' || freq === 'monthly_last';
              return (
                <DateField
                  label="Due date"
                  value={field.value}
                  onChange={field.onChange}
                  errorMessage={errors.nextDueDate?.message}
                  disabled={anchored}
                  helperText={
                    freq === 'monthly_first'
                      ? 'Locked to the 1st of the next month.'
                      : freq === 'monthly_last'
                        ? 'Locked to the last day of the current month.'
                        : undefined
                  }
                />
              );
            }}
          />

          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text style={styles.switchLabel}>Active</Text>
                  <Text style={styles.switchHelp}>
                    When off, this bill stops showing in upcoming.
                  </Text>
                </View>
                <Switch value={field.value} onValueChange={field.onChange} />
              </View>
            )}
          />

          <Controller
            control={control}
            name="includedMemberIds"
            render={({ field }) => (
              <View style={styles.group}>
                <Text style={styles.label}>Split between</Text>
                <Text style={styles.helper}>
                  Exclude anyone who shouldn&apos;t owe a share of this bill.
                </Text>
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
                {errors.includedMemberIds ? (
                  <Text style={styles.error}>{errors.includedMemberIds.message}</Text>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="splitType"
            render={({ field: splitTypeField }) => {
              const watchedAmount = watch('amount');
              const isVariable = watchedAmount.trim() === '';
              const includedIds = watch('includedMemberIds');
              const sharesField = watch('shares');
              const availableTypes = isVariable
                ? SPLIT_TYPES.filter((t) => t.value !== 'custom_amt')
                : SPLIT_TYPES;

              const onSplitTypeChange = (newType: SplitType) => {
                splitTypeField.onChange(newType);
                if (newType === 'equal') {
                  setValue('shares', []);
                } else {
                  const existing = sharesField;
                  const hasExisting = includedIds.every((id) =>
                    existing.some((s) => s.member_id === id),
                  );
                  if (hasExisting) {
                    setValue('shares', existing);
                  } else {
                    setValue(
                      'shares',
                      includedIds.map((id) => ({ member_id: id, value: 0 })),
                    );
                  }
                }
              };

              const updateShareValue = (memberId: string, raw: string) => {
                const parsed = parseFloat(raw);
                let val = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
                if (splitTypeField.value === 'custom_amt' && totalAmount > 0) {
                  const othersSum = sharesField
                    .filter(
                      (s) =>
                        s.member_id !== memberId &&
                        includedIds.includes(s.member_id),
                    )
                    .reduce((acc, s) => acc + s.value, 0);
                  val = Math.min(
                    val,
                    parseFloat((totalAmount - othersSum).toFixed(2)),
                  );
                }
                setValue(
                  'shares',
                  sharesField.map((s) =>
                    s.member_id === memberId ? { ...s, value: val } : s,
                  ),
                );
              };

              const includedShares = sharesField.filter((s) =>
                includedIds.includes(s.member_id),
              );
              const shareSum = sumShares(includedShares);
              const parsedAmount = parseFloat(watchedAmount);
              const totalAmount = Number.isNaN(parsedAmount) ? 0 : parsedAmount;

              const amtValid =
                splitTypeField.value === 'custom_amt' &&
                shareSum === parseFloat(totalAmount.toFixed(2));
              const showValidation =
                splitTypeField.value === 'custom_amt' && includedShares.length > 0;

              return (
                <View style={styles.group}>
                  <Text style={styles.label}>Split method</Text>
                  <View style={styles.chips}>
                    {availableTypes.map((t) => {
                      const selected = splitTypeField.value === t.value;
                      return (
                        <Pressable
                          key={t.value}
                          onPress={() => onSplitTypeChange(t.value)}
                          style={[styles.chip, selected && styles.chipSelected]}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                        >
                          <Text
                            style={[
                              styles.chipLabel,
                              selected && styles.chipLabelSelected,
                            ]}
                          >
                            {t.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {splitTypeField.value === 'custom_amt' ? (
                    <View style={styles.sharesSection}>
                      {includedIds.map((id) => {
                        const m = members.find((mem) => mem.id === id);
                        if (!m) return null;
                        const share = sharesField.find((s) => s.member_id === id);
                        const displayName =
                          m.id === membership?.id
                            ? `${m.display_name} (you)`
                            : m.display_name;
                        return (
                          <View key={id} style={styles.shareRow}>
                            <Text style={styles.shareName} numberOfLines={1}>
                              {displayName}
                            </Text>
                            <View style={styles.shareInputWrap}>
                              <TextField
                                value={share ? String(share.value) : '0'}
                                onChangeText={(v) => updateShareValue(id, v)}
                                keyboardType="decimal-pad"
                                placeholder="0"
                              />
                            </View>
                            <Text style={styles.shareUnit}>$</Text>
                          </View>
                        );
                      })}

                      {showValidation ? (() => {
                        const allFilled =
                          includedShares.length > 0 &&
                          includedShares.every((s) => s.value > 0);
                        const remaining = parseFloat(
                          (totalAmount - shareSum).toFixed(2),
                        );
                        const isMismatch = allFilled && !amtValid && totalAmount > 0;
                        return (
                          <View
                            style={[
                              styles.shareTotal,
                              amtValid
                                ? styles.shareTotalValid
                                : isMismatch
                                  ? styles.shareTotalError
                                  : undefined,
                            ]}
                          >
                            <Text
                              style={[
                                styles.shareTotalText,
                                amtValid
                                  ? styles.shareTotalTextValid
                                  : isMismatch
                                    ? styles.shareTotalTextError
                                    : undefined,
                              ]}
                            >
                              {amtValid
                                ? `Total: ${formatUSD(shareSum)} ✓`
                                : isMismatch
                                  ? `Total: ${formatUSD(shareSum)} — doesn't match bill amount of ${formatUSD(totalAmount)}`
                                  : `Total: ${formatUSD(shareSum)} (${formatUSD(remaining)} remaining)`}
                            </Text>
                          </View>
                        );
                      })() : null}

                      {includedIds.length > 0 && totalAmount > 0 ? (
                        <Pressable
                          onPress={() =>
                            setValue(
                              'shares',
                              evenAmtShares(includedIds, totalAmount),
                            )
                          }
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="Split evenly"
                        >
                          <Text style={styles.splitEvenlyLink}>Split evenly</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            }}
          />

          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={save.isPending ? 'Saving\u2026' : isNew ? 'Add bill' : 'Save changes'}
            onPress={handleSubmit(onSubmit)}
            loading={save.isPending}
          />
          {!isNew && !isLocked ? (
            <Button
              label="Delete"
              variant="secondary"
              onPress={handleDelete}
              loading={del.isPending}
            />
          ) : null}
          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => {
              if (isNew) {
                router.back();
              } else {
                setIsEditing(false);
              }
            }}
          />
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
  switchLabel: {
    ...Typography.body,
    color: Colors.dark,
    fontWeight: '600',
  },
  switchHelp: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  helper: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  sharesSection: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  shareName: {
    ...Typography.subhead,
    color: Colors.dark,
    flex: 1,
  },
  shareInputWrap: {
    width: 90,
  },
  shareUnit: {
    ...Typography.subhead,
    color: Colors.mid,
    width: 16,
  },
  shareTotal: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: 6,
    backgroundColor: Colors.warningBg,
  },
  shareTotalValid: {
    backgroundColor: Colors.successBg,
  },
  shareTotalError: {
    backgroundColor: Colors.dangerBg,
  },
  shareTotalText: {
    ...Typography.footnote,
    color: Colors.warning,
    fontWeight: '600',
  },
  shareTotalTextValid: {
    color: Colors.success,
  },
  shareTotalTextError: {
    color: Colors.danger,
  },
  splitEvenlyLink: {
    ...Typography.footnote,
    color: Colors.primary,
    fontWeight: '600',
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
  lockedNote: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.warningBg,
    borderRadius: 8,
  },
  lockedNoteText: {
    ...Typography.footnote,
    color: Colors.warning,
    fontWeight: '600',
  },
  headerAction: {
    ...Typography.subhead,
    color: Colors.primary,
    fontWeight: '600',
    paddingHorizontal: Spacing.sm,
  },
  paymentsCard: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  paymentsHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  paymentsTitle: {
    ...Typography.title3,
    color: Colors.dark,
  },
  paymentsMeta: {
    ...Typography.footnote,
    color: Colors.mid,
    fontWeight: '600',
  },
  cycleAmountEdit: {
    gap: Spacing.sm,
  },
  cycleAmountActions: {
    gap: Spacing.sm,
  },
  cycleAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cycleAmountValue: {
    ...Typography.body,
    color: Colors.dark,
    fontWeight: '600',
  },
  statusBanner: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
  },
  statusBannerSuccess: {
    backgroundColor: Colors.success,
  },
  statusBannerWaiting: {
    backgroundColor: Colors.successBg,
  },
  statusBannerText: {
    ...Typography.subhead,
    fontWeight: '700',
  },
  statusBannerTextSuccess: {
    color: Colors.white,
  },
  statusBannerTextWaiting: {
    color: Colors.success,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.white,
    gap: Spacing.md,
  },
  memberRowPaid: {
    backgroundColor: Colors.primaryBg,
  },
  memberRowBody: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    ...Typography.callout,
    color: Colors.dark,
    fontWeight: '600',
  },
  memberMeta: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  paidBadge: {
    ...Typography.footnote,
    fontWeight: '700',
  },
  paidBadgePaid: {
    color: Colors.primary,
  },
  paidBadgeUnpaid: {
    color: Colors.mid,
  },
  pressed: {
    opacity: 0.6,
  },
});
