import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useCurrentCycle, useExpenses } from '@/hooks/useExpenses';
import { useCurrentHousehold, useMembers } from '@/hooks/useHousehold';
import { formatUSD } from '@/utils/currency';

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function BalanceBreakdownScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { data: membership } = useCurrentHousehold();
  const householdId = membership?.household_id;
  const myId = membership?.id;

  const { data: cycle } = useCurrentCycle(householdId);
  const { data: members = [] } = useMembers(householdId);
  const { data: expenses = [], isLoading } = useExpenses(householdId, cycle?.id);

  const other = members.find((m) => m.id === memberId);

  const goBackToBalances = useCallback(() => {
    router.replace('/settle');
  }, []);

  const { youOwe, theyOwe, youOweTotal, theyOweTotal } = useMemo(() => {
    const youOwe: { id: string; description: string; date: string; amount: number }[] = [];
    const theyOwe: { id: string; description: string; date: string; amount: number }[] = [];
    for (const e of expenses) {
      const payer = e.paid_by_member_id;
      for (const s of e.expense_splits) {
        if (s.settled_at != null) continue;
        if (s.member_id === payer) continue;
        // Expenses where current user owes the other
        if (payer === memberId && s.member_id === myId) {
          youOwe.push({
            id: `${e.id}:${s.id}`,
            description: e.description,
            date: e.date,
            amount: Number(s.amount_owed),
          });
        }
        // Expenses where other member owes current user
        if (payer === myId && s.member_id === memberId) {
          theyOwe.push({
            id: `${e.id}:${s.id}`,
            description: e.description,
            date: e.date,
            amount: Number(s.amount_owed),
          });
        }
      }
    }
    return {
      youOwe,
      theyOwe,
      youOweTotal: youOwe.reduce((sum, x) => sum + x.amount, 0),
      theyOweTotal: theyOwe.reduce((sum, x) => sum + x.amount, 0),
    };
  }, [expenses, memberId, myId]);

  const net = youOweTotal - theyOweTotal;
  const netLabel =
    net > 0.005
      ? `You owe ${other?.display_name ?? 'them'} ${formatUSD(net)}`
      : net < -0.005
        ? `${other?.display_name ?? 'They'} owes you ${formatUSD(Math.abs(net))}`
        : 'Settled with this roommate';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: other?.display_name ?? 'Expenses',
          headerLeft: () => (
            <Pressable
              onPress={goBackToBalances}
              accessibilityRole="button"
              accessibilityLabel="Back to balances"
              hitSlop={12}
            >
              <Text style={styles.headerBack}>‹ Balances</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.netCard}>
              <Text style={styles.netLabel}>{netLabel}</Text>
              <Text style={styles.netHelp}>Unsettled expenses for this cycle only.</Text>
            </View>

            {youOwe.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>You owe</Text>
                  <Text style={styles.sectionTotal}>{formatUSD(youOweTotal)}</Text>
                </View>
                {youOwe.map((row) => (
                  <Pressable
                    key={row.id}
                    style={styles.row}
                    onPress={() =>
                      router.push({
                        pathname: '/expenses/[id]',
                        params: { id: row.id.split(':')[0]! },
                      })
                    }
                    accessibilityRole="button"
                  >
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{row.description}</Text>
                      <Text style={styles.rowMeta}>{formatDate(row.date)}</Text>
                    </View>
                    <Text style={styles.rowAmount}>{formatUSD(row.amount)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {theyOwe.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>
                    {other?.display_name ?? 'They'} owes you
                  </Text>
                  <Text style={styles.sectionTotal}>{formatUSD(theyOweTotal)}</Text>
                </View>
                {theyOwe.map((row) => (
                  <Pressable
                    key={row.id}
                    style={styles.row}
                    onPress={() =>
                      router.push({
                        pathname: '/expenses/[id]',
                        params: { id: row.id.split(':')[0]! },
                      })
                    }
                    accessibilityRole="button"
                  >
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{row.description}</Text>
                      <Text style={styles.rowMeta}>{formatDate(row.date)}</Text>
                    </View>
                    <Text style={styles.rowAmount}>{formatUSD(row.amount)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {youOwe.length === 0 && theyOwe.length === 0 ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyBody}>
                  No direct unsettled expenses between you. The balance may come from debt
                  simplification across the household.
                </Text>
              </View>
            ) : (
              <View style={styles.mathCard}>
                <View style={styles.mathRow}>
                  <Text style={styles.mathLabel}>You owe</Text>
                  <Text style={styles.mathValue}>{formatUSD(youOweTotal)}</Text>
                </View>
                <View style={styles.mathRow}>
                  <Text style={styles.mathLabel}>
                    {other?.display_name ?? 'They'} owes you
                  </Text>
                  <Text style={styles.mathValue}>{formatUSD(theyOweTotal)}</Text>
                </View>
                <View style={styles.mathDivider} />
                <View style={styles.mathRow}>
                  <Text style={styles.mathTotalLabel}>
                    {net > 0.005
                      ? `You owe ${other?.display_name ?? 'them'}`
                      : net < -0.005
                        ? `${other?.display_name ?? 'They'} owes you`
                        : 'Settled'}
                  </Text>
                  <Text style={styles.mathTotalValue}>{formatUSD(Math.abs(net))}</Text>
                </View>
              </View>
            )}
          </>
        )}
        <Button label="Back" variant="secondary" onPress={goBackToBalances} />
      </ScrollView>
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
    gap: Spacing.lg,
    flexGrow: 1,
  },
  netCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  netLabel: {
    ...Typography.title3,
    color: Colors.dark,
  },
  netHelp: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    ...Typography.footnote,
    color: Colors.mid,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTotal: {
    ...Typography.subhead,
    color: Colors.dark,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...Typography.callout,
    color: Colors.dark,
    fontWeight: '600',
  },
  rowMeta: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  rowAmount: {
    ...Typography.callout,
    color: Colors.dark,
    fontWeight: '700',
  },
  empty: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
  },
  emptyInline: {
    padding: Spacing.md,
    backgroundColor: Colors.warningBg,
    borderRadius: 12,
  },
  emptyBody: {
    ...Typography.footnote,
    color: Colors.dark,
  },
  mathCard: {
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  mathRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mathLabel: {
    ...Typography.body,
    color: Colors.dark,
  },
  mathValue: {
    ...Typography.body,
    color: Colors.dark,
    fontWeight: '600',
  },
  mathDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.primary,
    opacity: 0.4,
    marginVertical: Spacing.xs,
  },
  mathTotalLabel: {
    ...Typography.callout,
    color: Colors.primary,
    fontWeight: '700',
    flex: 1,
    marginRight: Spacing.sm,
  },
  mathTotalValue: {
    ...Typography.title3,
    color: Colors.primary,
    fontWeight: '700',
  },
  headerBack: {
    ...Typography.body,
    color: Colors.primary,
    paddingHorizontal: Spacing.sm,
  },
});
