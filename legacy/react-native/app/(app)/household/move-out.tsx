import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MemberAvatar } from '@/components/household/MemberAvatar';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useCurrentCycle } from '@/hooks/useExpenses';
import { useCurrentHousehold, useMembers } from '@/hooks/useHousehold';
import { useCompleteMoveOut } from '@/hooks/useMoveOut';
import { formatUSD } from '@/utils/currency';
import { cycleTotalDays, daysPresent } from '@/utils/proration';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type Step = 'pick' | 'review' | 'done';

export default function MoveOutScreen() {
  const { data: membership } = useCurrentHousehold();
  const householdId = membership?.household_id;

  const { data: members = [] } = useMembers(householdId);
  const { data: cycle } = useCurrentCycle(householdId);
  const complete = useCompleteMoveOut();

  const [memberId, setMemberId] = useState<string | null>(membership?.id ?? null);
  const [date, setDate] = useState<string>(todayIso());
  const [dateError, setDateError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('pick');

  const selectedMember = useMemo(
    () => members.find((m) => m.id === memberId) ?? null,
    [members, memberId],
  );

  const prorateInfo = useMemo(() => {
    if (!cycle) return null;
    return {
      total: cycleTotalDays(cycle.start_date, cycle.end_date),
      present: daysPresent(cycle.start_date, cycle.end_date, date),
    };
  }, [cycle, date]);

  const goReview = () => {
    setDateError(null);
    if (!DATE_RE.test(date)) {
      setDateError('Use format YYYY-MM-DD');
      return;
    }
    if (!memberId) {
      Alert.alert('Pick a member', 'Choose who is moving out.');
      return;
    }
    if (cycle && date < cycle.start_date) {
      setDateError(`Must be on or after cycle start (${cycle.start_date}).`);
      return;
    }
    setStep('review');
  };

  const onConfirm = async () => {
    if (!householdId || !memberId) return;
    try {
      await complete.mutateAsync({ householdId, memberId, moveOutDate: date });
      setStep('done');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not complete move-out.';
      Alert.alert('Move-out failed', message);
    }
  };

  if (step === 'done') {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: true, title: 'Move out' }} />
        <View style={styles.doneInner}>
          <Text style={styles.title}>Move-out complete</Text>
          <Text style={styles.body}>
            {selectedMember?.display_name ?? 'That member'}&apos;s splits have been prorated and
            their spot is closed out.
          </Text>
          <Button label="Done" onPress={() => router.replace('/household')} />
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'review') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Stack.Screen options={{ headerShown: true, title: 'Review move-out' }} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Confirm</Text>
          <View style={styles.reviewCard}>
            <Text style={styles.reviewLabel}>Departing</Text>
            <Text style={styles.reviewValue}>{selectedMember?.display_name ?? '—'}</Text>

            <Text style={styles.reviewLabel}>Move-out date</Text>
            <Text style={styles.reviewValue}>{formatDateLabel(date)}</Text>

            {prorateInfo && cycle ? (
              <>
                <Text style={styles.reviewLabel}>Cycle</Text>
                <Text style={styles.reviewValue}>
                  {formatDateLabel(cycle.start_date)} – {formatDateLabel(cycle.end_date)} ·{' '}
                  {prorateInfo.present}/{prorateInfo.total} days
                </Text>
              </>
            ) : null}
          </View>

          <Text style={styles.body}>
            Recurring bills in this cycle will be prorated to{' '}
            {prorateInfo ? `${prorateInfo.present}/${prorateInfo.total}` : 'days-present'} of
            each split. One-time expenses after the move-out date will be removed from their
            share. The freed amount is redistributed across the remaining roommates.
          </Text>

          <Text style={styles.helper}>
            This does not collect payment. Use Settle up to send any outstanding balance after.
          </Text>
        </ScrollView>
        <View style={styles.footer}>
          <Button
            label={complete.isPending ? 'Finalizing\u2026' : 'Confirm move-out'}
            onPress={onConfirm}
            loading={complete.isPending}
          />
          <Button
            label="Back"
            variant="secondary"
            onPress={() => setStep('pick')}
            disabled={complete.isPending}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Move out' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Who is moving out?</Text>
          <View style={styles.memberList}>
            {members.map((m) => {
              const selected = m.id === memberId;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMemberId(m.id)}
                  style={[styles.memberRow, selected && styles.memberRowSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <MemberAvatar displayName={m.display_name} color={m.color} size={32} />
                  <Text style={styles.memberLabel}>
                    {m.display_name}
                    {m.id === membership?.id ? ' (you)' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <DateField
            label="Move-out date"
            value={date}
            onChange={(iso) => {
              setDate(iso);
              setDateError(null);
            }}
            minimumDate={cycle ? isoToDate(cycle.start_date) : undefined}
            errorMessage={dateError ?? undefined}
          />

          <Text style={styles.helper}>
            Defaults to today. The final cycle will be prorated by days-present.
          </Text>
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Review" onPress={goReview} disabled={!memberId || !cycle} />
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
    padding: Spacing.base,
    gap: Spacing.md,
  },
  title: {
    ...Typography.title2,
    color: Colors.dark,
  },
  body: {
    ...Typography.body,
    color: Colors.dark,
  },
  helper: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  memberList: {
    gap: Spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light,
    backgroundColor: Colors.white,
  },
  memberRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  memberLabel: {
    ...Typography.body,
    color: Colors.dark,
  },
  reviewCard: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    gap: Spacing.xs,
  },
  reviewLabel: {
    ...Typography.footnote,
    color: Colors.mid,
    marginTop: Spacing.xs,
  },
  reviewValue: {
    ...Typography.body,
    color: Colors.dark,
    fontWeight: '600',
  },
  doneInner: {
    flex: 1,
    padding: Spacing.base,
    gap: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
});
