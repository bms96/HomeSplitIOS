import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { getExcludedMemberIds } from '@/hooks/useRecurringBills';
import type { Database } from '@/types/database';
import { formatFrequency } from '@/utils/billFrequency';
import { isBillEffectivelyOverdue } from '@/utils/billStatus';
import { formatUSD } from '@/utils/currency';

type Bill = Database['public']['Tables']['recurring_bills']['Row'];
type Member = Database['public']['Tables']['members']['Row'];

function daysUntil(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return Number.POSITIVE_INFINITY;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDueLabel(iso: string): string {
  const days = daysUntil(iso);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

type Props = {
  bill: Bill;
  members?: Member[];
  currentMemberId?: string | null;
  paidCount?: number;
  /** Per-cycle amount override (overrides bill.amount for fixed; required for variable). */
  cycleAmount?: number | null;
  /** Whether the current viewer has a bill_cycle_payments row for this cycle. */
  iPaid?: boolean;
  onPress: () => void;
};

export function RecurringBillCard({
  bill,
  members,
  currentMemberId,
  paidCount,
  cycleAmount,
  iPaid,
  onPress,
}: Props) {
  const excluded = new Set(getExcludedMemberIds(bill.custom_splits));
  const includedIds = (members ?? []).filter((m) => !excluded.has(m.id)).map((m) => m.id);
  const includedCount = includedIds.length;
  const effectiveAmount: number | null =
    cycleAmount != null ? cycleAmount : bill.amount != null ? Number(bill.amount) : null;
  const paidLabel =
    paidCount != null && includedCount > 0 ? `${paidCount} of ${includedCount} paid` : null;

  const needsAmount = effectiveAmount == null;
  const amountLabel = needsAmount
    ? 'Amount Not Set'
    : formatUSD(effectiveAmount);

  const days = daysUntil(bill.next_due_date);
  const isOverdue =
    bill.active &&
    isBillEffectivelyOverdue({
      daysUntilDue: days,
      paidCount: paidCount ?? 0,
      includedCount,
    });
  const isUrgent = bill.active && (days === 0 || days === 1);
  const dueLabel = bill.active ? formatDueLabel(bill.next_due_date) : 'Paused';

  const freqLabel = formatFrequency(bill.frequency, bill.next_due_date);
  const metaLabel = paidLabel ? `${freqLabel} · ${paidLabel}` : freqLabel;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        iPaid && bill.active && !isOverdue && styles.cardPaid,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${bill.name}, ${
        iPaid ? 'you have paid your share. ' : ''
      }${needsAmount ? 'amount not set for this cycle' : amountLabel}, ${dueLabel}, ${freqLabel}${
        paidLabel ? `, ${paidLabel}` : ''
      }`}
    >
      <View style={styles.row}>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {bill.name}
            <Text
              style={[
                styles.nameSuffix,
                !bill.active && styles.nameSuffixPaused,
                isOverdue && styles.nameSuffixOverdue,
                isUrgent && styles.nameSuffixUrgent,
              ]}
            >
              {'  ·  '}
              {dueLabel}
            </Text>
          </Text>
          <Text style={styles.meta}>{metaLabel}</Text>
        </View>
        <View style={styles.right}>
          {needsAmount ? (
            <View style={styles.setAmountBadge}>
              <Text style={styles.setAmountBadgeText}>Amount Not Set</Text>
            </View>
          ) : (
            <Text style={styles.amount}>{amountLabel}</Text>
          )}
          {iPaid ? (
            <View style={styles.paidBadge} accessibilityLabel="You paid">
              <Text style={styles.paidBadgeText}>✓ You paid</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
  },
  cardPaid: {
    backgroundColor: Colors.successBg,
  },
  pressed: {
    opacity: 0.75,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Typography.body,
    color: Colors.dark,
    fontWeight: '600',
  },
  nameSuffix: {
    ...Typography.footnote,
    color: Colors.mid,
    fontWeight: '500',
  },
  nameSuffixUrgent: {
    color: Colors.warning,
    fontWeight: '700',
  },
  nameSuffixOverdue: {
    color: Colors.danger,
    fontWeight: '700',
  },
  nameSuffixPaused: {
    color: Colors.warning,
    fontWeight: '600',
  },
  meta: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  right: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  amount: {
    ...Typography.callout,
    color: Colors.dark,
    fontWeight: '600',
  },
  setAmountBadge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
    borderRadius: 4,
    backgroundColor: Colors.warningBg,
  },
  setAmountBadgeText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '700',
    letterSpacing: 0.3,
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
});
