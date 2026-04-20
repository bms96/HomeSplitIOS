import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseCard } from '@/components/expenses/ExpenseCard';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useCurrentHousehold } from '@/hooks/useHousehold';
import { useCurrentCycle, useExpenses, type ExpenseWithDetails } from '@/hooks/useExpenses';
import { formatUSD } from '@/utils/currency';

type PaidFilter = 'both' | 'paid' | 'unpaid';
type Sort = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

const PAID_FILTERS: { value: PaidFilter; label: string }[] = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'both', label: 'Both' },
];

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'amount_desc', label: 'Largest first' },
  { value: 'amount_asc', label: 'Smallest first' },
];

/**
 * "Paid" from the viewer's perspective:
 * - Payer: every non-payer split is settled (all debtors have paid me back).
 * - Debtor: my own split is settled (I've paid the payer).
 * - Uninvolved: treated as paid — not their ledger.
 */
function isExpensePaidForViewer(
  expense: ExpenseWithDetails,
  viewerMemberId: string | null | undefined,
): boolean {
  if (!viewerMemberId) return false;
  if (viewerMemberId === expense.paid_by_member_id) {
    const debts = expense.expense_splits.filter(
      (s) => s.member_id !== expense.paid_by_member_id,
    );
    if (debts.length === 0) return true;
    return debts.every((s) => s.settled_at != null);
  }
  const mySplit = expense.expense_splits.find((s) => s.member_id === viewerMemberId);
  if (!mySplit) return true;
  return mySplit.settled_at != null;
}

export default function ExpensesScreen() {
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const initialPaid: PaidFilter = (() => {
    switch (filterParam) {
      case 'paid':
        return 'paid';
      case 'both':
        return 'both';
      case 'unpaid':
      default:
        return 'unpaid';
    }
  })();

  const [paid, setPaid] = useState<PaidFilter>(initialPaid);
  const [sort, setSort] = useState<Sort>('date_desc');

  const { data: membership } = useCurrentHousehold();
  const householdId = membership?.household_id;
  const currentMemberId = membership?.id;

  const { data: cycle, isLoading: cycleLoading } = useCurrentCycle(householdId);
  const { data: expenses = [], isLoading: listLoading, isError, refetch, isRefetching } =
    useExpenses(householdId, cycle?.id);

  const filtered = useMemo(() => {
    const byPaid = expenses.filter((e) => {
      if (paid === 'paid') return isExpensePaidForViewer(e, currentMemberId);
      if (paid === 'unpaid') return !isExpensePaidForViewer(e, currentMemberId);
      return true;
    });
    const sorted = [...byPaid].sort((a, b) => {
      switch (sort) {
        case 'date_asc':
          return a.date.localeCompare(b.date);
        case 'amount_desc':
          return Number(b.amount) - Number(a.amount);
        case 'amount_asc':
          return Number(a.amount) - Number(b.amount);
        default:
          return b.date.localeCompare(a.date);
      }
    });
    return sorted;
  }, [expenses, paid, sort, currentMemberId]);

  const total = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort';

  const openSortMenu = () => {
    if (Platform.OS === 'ios') {
      const labels = SORT_OPTIONS.map((o) => o.label);
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...labels, 'Cancel'], cancelButtonIndex: labels.length, title: 'Sort by' },
        (index) => {
          const option = SORT_OPTIONS[index];
          if (option) setSort(option.value);
        },
      );
      return;
    }
    Alert.alert(
      'Sort by',
      undefined,
      [
        ...SORT_OPTIONS.map((o) => ({ text: o.label, onPress: () => setSort(o.value) })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={() => void refetch()}
        refreshing={isRefetching}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>This cycle</Text>
            <Text style={styles.subtitle}>
              {filtered.length} expense{filtered.length === 1 ? '' : 's'} · {formatUSD(total)}
            </Text>

            <View style={styles.chips}>
              {PAID_FILTERS.map((f) => {
                const selected = paid === f.value;
                return (
                  <Pressable
                    key={f.value}
                    onPress={() => setPaid(f.value)}
                    style={[styles.chip, selected && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={openSortMenu}
              style={styles.sortRow}
              accessibilityRole="button"
              accessibilityLabel={`Sort: ${sortLabel}. Tap to change.`}
            >
              <Text style={styles.sortLabel}>Sort: {sortLabel}</Text>
              <Text style={styles.sortAction}>Change ▾</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <ExpenseCard
            expense={item}
            currentMemberId={currentMemberId}
            onPress={() =>
              router.push({ pathname: '/expenses/[id]', params: { id: item.id } })
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          cycleLoading || listLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : isError ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Could not load expenses</Text>
              <Button label="Retry" variant="secondary" onPress={() => void refetch()} />
            </View>
          ) : expenses.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No expenses yet</Text>
              <Text style={styles.emptyBody}>
                Add a one-time expense — groceries, dinner, a Costco run. Recurring
                bills like rent live in the Bills tab.
              </Text>
              <Button
                label="Go to bills"
                variant="secondary"
                onPress={() => router.push('/bills')}
              />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptyBody}>
                No expenses match this filter.
              </Text>
            </View>
          )
        }
      />
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
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl * 2,
    flexGrow: 1,
  },
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.title1,
    color: Colors.dark,
  },
  subtitle: {
    ...Typography.subhead,
    color: Colors.mid,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  chip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
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
    ...Typography.footnote,
    color: Colors.mid,
  },
  chipLabelSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  sortLabel: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  sortAction: {
    ...Typography.footnote,
    color: Colors.primary,
    fontWeight: '600',
  },
  sep: {
    height: 1,
    backgroundColor: Colors.surface,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.title3,
    color: Colors.dark,
  },
  emptyBody: {
    ...Typography.body,
    color: Colors.mid,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  fabWrap: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    bottom: Spacing.base,
  },
});
