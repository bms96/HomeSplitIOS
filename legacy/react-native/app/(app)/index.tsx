import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useBalances, useCarryoverDebt, useMySettlements } from '@/hooks/useBalances';
import { useCurrentCycle, useExpenses } from '@/hooks/useExpenses';
import { useCurrentHousehold, useMembers } from '@/hooks/useHousehold';
import {
  getExcludedMemberIds,
  getShares,
  useBillCycleAmounts,
  useBillCyclePayments,
  useRecurringBills,
} from '@/hooks/useRecurringBills';
import { supabase } from '@/lib/supabase';
import { isBillEffectivelyOverdue } from '@/utils/billStatus';
import {
  computeBillsDueCardState,
  computeOwedToYouCardState,
  computeYouOweCardState,
} from '@/utils/cardState';
import { formatUSD } from '@/utils/currency';

const UPCOMING_MAX = 5;
type UpcomingWindow = '7d' | 'month';

function formatCycleRange(start: string, end: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function cycleWord(start: string, end: string): string {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return 'Cycle';
  const days = Math.round(
    (new Date(ey, em - 1, ed).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86_400_000,
  );
  if (days <= 10) return 'This week';
  if (days <= 20) return 'This period';
  return 'This month';
}

function daysUntil(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return Number.POSITIVE_INFINITY;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function daysToEndOfMonth(): number {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDueLabel(iso: string): string {
  const days = daysUntil(iso);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

const toneStyles = {
  positive: { backgroundColor: Colors.successBg, borderColor: Colors.success },
  caution: { backgroundColor: Colors.warningBg, borderColor: Colors.warning },
  alert: { backgroundColor: Colors.dangerBg, borderColor: Colors.danger },
} as const;

const toneLabelStyles = {
  positive: { color: Colors.success },
  caution: { color: Colors.warning },
  alert: { color: Colors.danger },
} as const;

export default function DashboardScreen() {
  const { data: membership } = useCurrentHousehold();
  const householdId = membership?.household_id;
  const currentMemberId = membership?.id;

  const { data: cycle } = useCurrentCycle(householdId);
  const { data: members = [] } = useMembers(householdId);
  const { data: expenses = [] } = useExpenses(householdId, cycle?.id);
  const { isLoading: balancesLoading } = useBalances(householdId, cycle?.id);
  const { data: bills = [] } = useRecurringBills(householdId);
  const { data: cyclePayments = [] } = useBillCyclePayments(householdId, cycle?.id);
  const { data: cycleAmounts = [] } = useBillCycleAmounts(householdId, cycle?.id);
  const { data: settlements = [] } = useMySettlements(householdId, cycle?.id, currentMemberId);
  const { data: carryover } = useCarryoverDebt(householdId, cycle?.id, currentMemberId);

  const { iOweCount, iOweAmount, owedToMeCount, owedToMeAmount } = useMemo(() => {
    let iOweCount = 0;
    let iOweAmount = 0;
    let owedToMeCount = 0;
    let owedToMeAmount = 0;
    if (!currentMemberId) {
      return { iOweCount, iOweAmount, owedToMeCount, owedToMeAmount };
    }
    for (const e of expenses) {
      const paidByMe = e.paid_by_member_id === currentMemberId;
      const mine = e.expense_splits.find((s) => s.member_id === currentMemberId);
      if (!paidByMe && mine && mine.settled_at == null) {
        iOweCount += 1;
        iOweAmount += Number(mine.amount_owed);
      }
      if (paidByMe) {
        const unsettledOthers = e.expense_splits.filter(
          (s) => s.member_id !== currentMemberId && s.settled_at == null,
        );
        if (unsettledOthers.length > 0) {
          owedToMeCount += 1;
          owedToMeAmount += unsettledOthers.reduce((sum, s) => sum + Number(s.amount_owed), 0);
        }
      }
    }
    return { iOweCount, iOweAmount, owedToMeCount, owedToMeAmount };
  }, [expenses, currentMemberId]);

  const [upcomingWindow, setUpcomingWindow] = useState<UpcomingWindow>('7d');
  const windowDays = upcomingWindow === '7d' ? 7 : daysToEndOfMonth();

  type BillItem = {
    id: string;
    days: number;
    dueDate: string;
    bill: (typeof bills)[number];
  };

  type OwedExpenseItem = {
    id: string;
    name: string;
    myShare: number;
    mySplitId: string;
    payerName: string | null;
    date: string;
  };

  const upcomingBills = useMemo<BillItem[]>(() => {
    return bills
      .filter((b) => b.active)
      .map((b) => ({
        id: b.id,
        days: daysUntil(b.next_due_date),
        dueDate: b.next_due_date,
        bill: b,
      }))
      .filter(({ days }) => days <= windowDays)
      .sort((a, b) => a.days - b.days)
      .slice(0, UPCOMING_MAX);
  }, [bills, windowDays]);

  const owedExpenses = useMemo<OwedExpenseItem[]>(() => {
    if (!currentMemberId) return [];
    return expenses
      .filter((e) => e.paid_by_member_id !== currentMemberId)
      .map((e) => {
        const mySplit = e.expense_splits.find((s) => s.member_id === currentMemberId);
        if (!mySplit || mySplit.settled_at != null) return null;
        const payer = members.find((m) => m.id === e.paid_by_member_id);
        return {
          id: e.id,
          name: e.description,
          myShare: Number(mySplit.amount_owed),
          mySplitId: mySplit.id,
          payerName: payer?.display_name ?? null,
          date: e.date,
        } satisfies OwedExpenseItem;
      })
      .filter((x): x is OwedExpenseItem => x != null)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, UPCOMING_MAX);
  }, [expenses, members, currentMemberId]);

  const queryClient = useQueryClient();
  const [payingSplitId, setPayingSplitId] = useState<string | null>(null);
  const markMyShareAsPaid = async (splitId: string) => {
    if (!householdId || payingSplitId) return;
    setPayingSplitId(splitId);
    try {
      const { error } = await supabase
        .from('expense_splits')
        .update({ settled_at: new Date().toISOString() })
        .eq('id', splitId);
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['expenses', householdId] }),
        queryClient.invalidateQueries({ queryKey: ['balances', householdId] }),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not mark paid.';
      Alert.alert('Could not mark paid', message);
    } finally {
      setPayingSplitId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.greeting}>
          <Text style={styles.hello}>Hi, {membership?.display_name ?? 'there'}</Text>
          <Text style={styles.householdName}>{membership?.household.name}</Text>
        </View>

        {(() => {
          const hasOverdueBills = upcomingBills.some((b) => {
            const excluded = new Set(getExcludedMemberIds(b.bill.custom_splits));
            const includedCount = members.filter((m) => !excluded.has(m.id)).length;
            const paidCount = cyclePayments.filter((p) => p.bill_id === b.bill.id).length;
            return isBillEffectivelyOverdue({
              daysUntilDue: b.days,
              paidCount,
              includedCount,
            });
          });
          const youOwe = computeYouOweCardState({
            count: iOweCount,
            hasCarryover: !!carryover?.iOweFromPrior,
          });
          const owedToYou = computeOwedToYouCardState({
            count: owedToMeCount,
            hasCarryover: !!carryover?.owedToMeFromPrior,
          });
          const billsDue = computeBillsDueCardState({
            count: upcomingBills.length,
            hasOverdue: hasOverdueBills,
          });
          return (
            <View style={styles.statsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.statCard,
                  toneStyles[youOwe.tone],
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push('/settle')}
                accessibilityRole="button"
                accessibilityLabel={`You owe on ${iOweCount} expense${iOweCount === 1 ? '' : 's'}, ${formatUSD(iOweAmount)}. ${youOwe.text}. Tap to view balances.`}
              >
                <View style={styles.statHead}>
                  <Text style={[styles.statLabel, toneLabelStyles[youOwe.tone]]}>You owe</Text>
                  <Text style={[styles.statChevron, toneLabelStyles[youOwe.tone]]}>›</Text>
                </View>
                {balancesLoading ? (
                  <ActivityIndicator color={Colors.dark} />
                ) : (
                  <Text style={styles.statCount}>{iOweCount}</Text>
                )}
                <Text style={[styles.statSub, toneLabelStyles[youOwe.tone]]}>{youOwe.text}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.statCard,
                  toneStyles[owedToYou.tone],
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push('/settle')}
                accessibilityRole="button"
                accessibilityLabel={`Owed to you on ${owedToMeCount} expense${owedToMeCount === 1 ? '' : 's'}, ${formatUSD(owedToMeAmount)}. ${owedToYou.text}. Tap to view balances.`}
              >
                <View style={styles.statHead}>
                  <Text style={[styles.statLabel, toneLabelStyles[owedToYou.tone]]}>Owed to you</Text>
                  <Text style={[styles.statChevron, toneLabelStyles[owedToYou.tone]]}>›</Text>
                </View>
                {balancesLoading ? (
                  <ActivityIndicator color={Colors.dark} />
                ) : (
                  <Text style={styles.statCount}>{owedToMeCount}</Text>
                )}
                <Text style={[styles.statSub, toneLabelStyles[owedToYou.tone]]}>{owedToYou.text}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.statCard,
                  toneStyles[billsDue.tone],
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push('/bills')}
                accessibilityRole="button"
                accessibilityLabel={`${upcomingBills.length} bill${upcomingBills.length === 1 ? '' : 's'} due. ${billsDue.text}. Tap to view bills.`}
              >
                <View style={styles.statHead}>
                  <Text style={[styles.statLabel, toneLabelStyles[billsDue.tone]]}>Bills due</Text>
                  <Text style={[styles.statChevron, toneLabelStyles[billsDue.tone]]}>›</Text>
                </View>
                <Text style={styles.statCount}>{upcomingBills.length}</Text>
                <Text style={[styles.statSub, toneLabelStyles[billsDue.tone]]}>{billsDue.text}</Text>
              </Pressable>
            </View>
          );
        })()}

        {cycle ? (
          <Text style={styles.cycleMeta}>
            {cycleWord(cycle.start_date, cycle.end_date)} · {formatCycleRange(cycle.start_date, cycle.end_date)}
          </Text>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Bills due</Text>
            <View style={styles.windowToggle}>
              {(['7d', 'month'] as const).map((w) => {
                const selected = upcomingWindow === w;
                return (
                  <Pressable
                    key={w}
                    onPress={() => setUpcomingWindow(w)}
                    style={[styles.windowBtn, selected && styles.windowBtnSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.windowBtnLabel,
                        selected && styles.windowBtnLabelSelected,
                      ]}
                    >
                      {w === '7d' ? '7 days' : 'This month'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {upcomingBills.length === 0 ? (
            <View style={styles.upcomingEmpty}>
              <Text style={styles.upcomingEmptyText}>
                No bills due {upcomingWindow === '7d' ? 'in the next 7 days' : 'this month'}.
              </Text>
            </View>
          ) : (
            <View style={styles.upcomingList}>
              {upcomingBills.map(({ bill, days }) => {
                const excluded = new Set(getExcludedMemberIds(bill.custom_splits));
                const includedCount = members.filter((m) => !excluded.has(m.id)).length;
                const amIIncluded = !!currentMemberId && !excluded.has(currentMemberId);
                const cycleOverride = cycleAmounts.find((a) => a.bill_id === bill.id);
                const effectiveAmount: number | null =
                  cycleOverride != null
                    ? Number(cycleOverride.amount)
                    : bill.amount != null
                      ? Number(bill.amount)
                      : null;
                const myShare = (() => {
                  if (effectiveAmount == null || !amIIncluded) return null;
                  const shares = getShares(bill.custom_splits);
                  if (bill.split_type === 'custom_pct' && shares.length > 0) {
                    const mine = shares.find((s) => s.member_id === currentMemberId);
                    return mine
                      ? parseFloat(((effectiveAmount * mine.value) / 100).toFixed(2))
                      : null;
                  }
                  if (bill.split_type === 'custom_amt' && shares.length > 0) {
                    const mine = shares.find((s) => s.member_id === currentMemberId);
                    return mine ? parseFloat(mine.value.toFixed(2)) : null;
                  }
                  return includedCount > 0
                    ? parseFloat((effectiveAmount / includedCount).toFixed(2))
                    : null;
                })();
                const needsAmount = effectiveAmount == null;
                const shareLabel = needsAmount
                  ? 'Amount Not Set'
                  : !amIIncluded
                    ? 'Not included'
                    : myShare != null
                      ? formatUSD(myShare)
                      : formatUSD(effectiveAmount!);
                const paidCount = cyclePayments.filter((p) => p.bill_id === bill.id).length;
                const paidMeta =
                  includedCount > 0 ? `${paidCount} of ${includedCount} paid` : null;
                const iPaid =
                  !!currentMemberId &&
                  cyclePayments.some(
                    (p) => p.bill_id === bill.id && p.member_id === currentMemberId,
                  );
                const isOverdue = isBillEffectivelyOverdue({
                  daysUntilDue: days,
                  paidCount,
                  includedCount,
                });
                const isUrgent = days === 0 || days === 1;
                return (
                  <Pressable
                    key={`bill:${bill.id}`}
                    onPress={() =>
                      router.push({ pathname: '/bills/[id]', params: { id: bill.id } })
                    }
                    style={({ pressed }) => [
                      styles.upcomingRow,
                      iPaid && !isOverdue && styles.upcomingRowPaid,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${bill.name}, ${
                      iPaid ? 'you have paid your share. ' : ''
                    }${
                      needsAmount ? 'amount not set for this cycle' : `your share ${shareLabel}`
                    }, due ${formatDueLabel(bill.next_due_date)}${
                      paidMeta ? `, ${paidMeta}` : ''
                    }`}
                  >
                    <View style={styles.upcomingBody}>
                      <Text style={styles.upcomingName} numberOfLines={1}>
                        {bill.name}
                        <Text
                          style={[
                            styles.upcomingNameSuffix,
                            isOverdue && styles.upcomingNameSuffixOverdue,
                            isUrgent && styles.upcomingNameSuffixUrgent,
                          ]}
                        >
                          {'  ·  '}
                          {formatDueLabel(bill.next_due_date)}
                        </Text>
                      </Text>
                      {paidMeta ? (
                        <Text style={styles.upcomingMeta}>{paidMeta}</Text>
                      ) : null}
                    </View>
                    <View style={styles.upcomingRight}>
                      {needsAmount ? (
                        <View
                          style={styles.tbdBadge}
                          accessibilityLabel="Amount not set for this cycle"
                        >
                          <Text style={styles.tbdBadgeText}>Amount Not Set</Text>
                        </View>
                      ) : (
                        <Text style={styles.upcomingAmount}>{shareLabel}</Text>
                      )}
                      {iPaid ? (
                        <View style={styles.paidBadge} accessibilityLabel="You paid">
                          <Text style={styles.paidBadgeText}>✓ You paid</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>You owe</Text>
          {owedExpenses.length === 0 ? (
            <View style={styles.upcomingEmpty}>
              <Text style={styles.upcomingEmptyText}>
                You&apos;re all settled up — no expenses owed.
              </Text>
            </View>
          ) : (
            <View style={styles.upcomingList}>
              {owedExpenses.map((item) => {
                const isMarking = payingSplitId === item.mySplitId;
                const payerLabel = item.payerName
                  ? `Paid by ${item.payerName}`
                  : 'Expense';
                return (
                  <Pressable
                    key={`expense:${item.id}`}
                    onPress={() =>
                      router.push({ pathname: '/expenses/[id]', params: { id: item.id } })
                    }
                    style={({ pressed }) => [styles.upcomingRow, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, you owe ${formatUSD(item.myShare)} to ${item.payerName ?? 'payer'}`}
                  >
                    <View style={styles.upcomingBody}>
                      <Text style={styles.upcomingName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.upcomingMeta}>{payerLabel}</Text>
                    </View>
                    <Pressable
                      onPress={() => markMyShareAsPaid(item.mySplitId)}
                      disabled={isMarking}
                      hitSlop={8}
                      style={({ pressed }) => [styles.markPaidBtn, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark my ${formatUSD(item.myShare)} share of ${item.name} as paid`}
                    >
                      {isMarking ? (
                        <ActivityIndicator color={Colors.primary} size="small" />
                      ) : (
                        <Text style={styles.markPaidLabel}>
                          Mark {formatUSD(item.myShare)} paid
                        </Text>
                      )}
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {settlements.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <View style={styles.upcomingList}>
              {settlements.map((s) => {
                const isOutgoing = s.from_member_id === currentMemberId;
                const other = isOutgoing ? s.to_member : s.from_member;
                const otherName = other?.display_name ?? 'Member';
                const dateLabel = new Date(s.settled_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
                return (
                  <View
                    key={s.id}
                    style={styles.upcomingRow}
                    accessibilityLabel={`${isOutgoing ? 'Paid' : 'Received'} ${formatUSD(Number(s.amount))} ${isOutgoing ? 'to' : 'from'} ${otherName} on ${dateLabel}`}
                  >
                    <View style={styles.upcomingBody}>
                      <Text style={styles.upcomingName} numberOfLines={1}>
                        {isOutgoing ? `Paid ${otherName}` : `${otherName} paid you`}
                      </Text>
                      <Text style={styles.upcomingMeta}>
                        {dateLabel} · {s.method.replace('_', ' ')}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.upcomingAmount,
                        isOutgoing ? styles.amountOut : styles.amountIn,
                      ]}
                    >
                      {isOutgoing ? '-' : '+'}
                      {formatUSD(Number(s.amount))}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {expenses.length === 0 ? (
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Get started</Text>
            {members.length < 2 ? (
              <Pressable
                onPress={() => router.push('/household/invite')}
                accessibilityRole="button"
              >
                <Text style={styles.tipLink}>→ Invite your roommates</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push('/bills')}
              accessibilityRole="button"
            >
              <Text style={styles.tipLink}>→ Add your recurring bills</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/expenses/add')}
              accessibilityRole="button"
            >
              <Text style={styles.tipLink}>→ Log your first expense</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.fabWrap} pointerEvents="box-none">
        <Button
          label="Add expense"
          onPress={() => router.push('/expenses/add')}
          disabled={!cycle}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scroll: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxxl * 2,
    gap: Spacing.lg,
  },
  greeting: {
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  hello: {
    ...Typography.subhead,
    color: Colors.mid,
  },
  householdName: {
    ...Typography.title1,
    color: Colors.dark,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 2,
    borderWidth: 1,
    borderColor: Colors.light,
  },
  statHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statChevron: {
    ...Typography.title3,
    color: Colors.primary,
    fontWeight: '700',
    lineHeight: Typography.footnote.fontSize,
    marginLeft: Spacing.xs,
  },
  statLabel: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  statCount: {
    ...Typography.title1,
    color: Colors.dark,
    fontWeight: '700',
    marginTop: 2,
  },
  statSub: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  cycleMeta: {
    ...Typography.footnote,
    color: Colors.mid,
    marginTop: -Spacing.xs,
  },
  fabWrap: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    bottom: Spacing.base,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...Typography.title3,
    color: Colors.dark,
  },
  sectionAction: {
    ...Typography.subhead,
    color: Colors.primary,
    fontWeight: '600',
  },
  upcomingList: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
  },
  upcomingEmpty: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
  },
  upcomingEmptyText: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  windowToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 2,
  },
  windowBtn: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: 6,
  },
  windowBtnSelected: {
    backgroundColor: Colors.white,
  },
  windowBtnLabel: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  windowBtnLabelSelected: {
    color: Colors.dark,
    fontWeight: '600',
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.white,
  },
  pressed: {
    opacity: 0.6,
  },
  upcomingBody: {
    flex: 1,
    gap: 2,
  },
  upcomingName: {
    ...Typography.callout,
    color: Colors.dark,
    fontWeight: '600',
  },
  upcomingMeta: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  upcomingNameSuffix: {
    ...Typography.footnote,
    color: Colors.mid,
    fontWeight: '500',
  },
  upcomingNameSuffixUrgent: {
    color: Colors.warning,
    fontWeight: '700',
  },
  upcomingNameSuffixOverdue: {
    color: Colors.danger,
    fontWeight: '700',
  },
  upcomingRowPaid: {
    backgroundColor: Colors.successBg,
    marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
  },
  paidBadge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  paidBadgeText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  upcomingAmount: {
    ...Typography.callout,
    color: Colors.dark,
    fontWeight: '600',
  },
  upcomingRight: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  markPaidBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  markPaidLabel: {
    ...Typography.footnote,
    color: Colors.primary,
    fontWeight: '700',
  },
  amountOut: {
    color: Colors.warning,
  },
  amountIn: {
    color: Colors.primary,
  },
  tbdBadge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
    borderRadius: 4,
    backgroundColor: Colors.warningBg,
  },
  tbdBadgeText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tipsCard: {
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  tipsTitle: {
    ...Typography.subhead,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  tipLink: {
    ...Typography.body,
    color: Colors.dark,
    paddingVertical: Spacing.xs,
  },
});
