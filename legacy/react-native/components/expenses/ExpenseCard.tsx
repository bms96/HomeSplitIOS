import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/expenses/CategoryIcon';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import type { ExpenseWithDetails } from '@/hooks/useExpenses';
import { formatUSD } from '@/utils/currency';

type Props = {
  expense: ExpenseWithDetails;
  currentMemberId: string | null | undefined;
  onPress?: () => void;
};

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ExpenseCard({ expense, currentMemberId, onPress }: Props) {
  const payer = expense.paid_by_member;
  const paidByYou = !!currentMemberId && payer?.id === currentMemberId;
  const yourShare = expense.expense_splits.find((s) => s.member_id === currentMemberId);
  const isAuto = !!expense.recurring_bill_id;

  const peerSplits = expense.expense_splits.filter((s) => s.member_id !== payer?.id);
  const outstandingPeers = peerSplits.filter((s) => s.settled_at == null);
  const outstandingTotal = outstandingPeers.reduce((sum, s) => sum + Number(s.amount_owed), 0);
  const isSelfOnlySplit =
    paidByYou &&
    expense.expense_splits.length === 1 &&
    expense.expense_splits[0]?.member_id === currentMemberId;
  const myShareUnsettled = !paidByYou && !!yourShare && yourShare.settled_at == null;

  let statusLabel: string;
  let statusColor: string;

  if (isSelfOnlySplit) {
    const mine = expense.expense_splits[0]!;
    if (mine.settled_at != null) {
      statusLabel = `You paid ${formatUSD(Number(mine.amount_owed))}`;
      statusColor = Colors.mid;
    } else {
      statusLabel = `Your share · ${formatUSD(Number(mine.amount_owed))} unpaid`;
      statusColor = Colors.warning;
    }
  } else if (paidByYou) {
    if (outstandingPeers.length > 0) {
      statusLabel = `${outstandingPeers.length} ${outstandingPeers.length === 1 ? 'owes' : 'owe'} you ${formatUSD(outstandingTotal)}`;
      statusColor = Colors.warning;
    } else {
      statusLabel = 'You paid · settled';
      statusColor = Colors.mid;
    }
  } else if (yourShare) {
    if (yourShare.settled_at != null) {
      statusLabel = `Paid ${formatUSD(Number(yourShare.amount_owed))} to ${payer?.display_name ?? 'payer'}`;
      statusColor = Colors.mid;
    } else {
      statusLabel = `You owe ${formatUSD(Number(yourShare.amount_owed))} to ${payer?.display_name ?? 'payer'}`;
      statusColor = Colors.warning;
    }
  } else {
    statusLabel = `${payer?.display_name ?? 'Someone'} paid`;
    statusColor = Colors.mid;
  }

  const hasOutstanding =
    (paidByYou && outstandingPeers.length > 0) ||
    (!paidByYou && myShareUnsettled);
  const accentStyle = hasOutstanding ? styles.accentOutstanding : null;

  const accessibilityLabel = `${isAuto ? 'Auto-posted expense: ' : 'Expense: '}${expense.description}, ${formatUSD(Number(expense.amount))}. ${statusLabel}.${onPress ? ' Tap to open.' : ''}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        accentStyle,
        pressed && onPress ? styles.pressed : null,
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <CategoryIcon category={expense.category} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.description} numberOfLines={1}>
            {expense.description}
          </Text>
          {isAuto ? (
            <View style={styles.badge} accessibilityLabel="Auto-posted from recurring bill">
              <Text style={styles.badgeText}>Auto</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.sub, { color: statusColor }]} numberOfLines={1}>
          {statusLabel} · {formatDateLabel(expense.date)}
        </Text>
      </View>
      <Text style={styles.amount}>{formatUSD(Number(expense.amount))}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    borderRadius: 4,
  },
  accentOutstanding: {
    borderLeftColor: Colors.warning,
    backgroundColor: Colors.warningBg,
  },
  pressed: {
    opacity: 0.65,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  description: {
    ...Typography.callout,
    color: Colors.dark,
    fontWeight: '600',
    flexShrink: 1,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
    borderRadius: 4,
    backgroundColor: Colors.primaryBg,
  },
  badgeText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sub: {
    ...Typography.footnote,
  },
  amount: {
    ...Typography.callout,
    color: Colors.dark,
    fontWeight: '600',
  },
});
