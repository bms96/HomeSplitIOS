import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MemberAvatar } from '@/components/household/MemberAvatar';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useBalances, useSettlePair } from '@/hooks/useBalances';
import { useCurrentCycle } from '@/hooks/useExpenses';
import { useCurrentHousehold, useMembers } from '@/hooks/useHousehold';
import { formatUSD } from '@/utils/currency';
import { buildCashAppUrl, buildVenmoUrl } from '@/utils/deeplinks';

export default function SettleScreen() {
  const { data: membership } = useCurrentHousehold();
  const householdId = membership?.household_id;
  const currentMemberId = membership?.id;
  const householdName = membership?.household.name ?? 'household';

  const { data: cycle } = useCurrentCycle(householdId);
  const { data: members = [] } = useMembers(householdId);
  const { data: balances, isLoading, refetch } = useBalances(householdId, cycle?.id);
  const settle = useSettlePair();
  const [busyId, setBusyId] = useState<string | null>(null);

  const byId = useMemo(() => {
    const map = new Map<string, typeof members[number]>();
    for (const m of members) map.set(m.id, m);
    return map;
  }, [members]);

  // Use pair-wise net debts for the user's own balances so "Mark paid"
  // always corresponds to real splits that settle_pair can clear.
  const myDebts = (balances?.pairwiseDebts ?? []).filter(
    (d) => d.from === currentMemberId || d.to === currentMemberId,
  );
  // For roommate-to-roommate rows (read-only), the simplified graph gives a
  // cleaner picture with fewer edges.
  const otherDebts = (balances?.debts ?? []).filter(
    (d) => d.from !== currentMemberId && d.to !== currentMemberId,
  );

  const openExternal = async (url: string, fallbackMsg: string) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        Alert.alert('Unavailable', fallbackMsg);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open', fallbackMsg);
    }
  };

  const handlePay = (debt: { from: string; to: string; amount: number }) => {
    const toMember = byId.get(debt.to);
    const note = `Homesplit · ${householdName}`;
    Alert.alert('Pay via', toMember?.display_name ?? 'Member', [
      {
        text: 'Venmo',
        onPress: () =>
          openExternal(
            buildVenmoUrl({ amount: debt.amount, note }),
            'Venmo is not installed.',
          ),
      },
      {
        text: 'Cash App',
        onPress: () =>
          openExternal(buildCashAppUrl({ amount: debt.amount }), 'Cash App is unavailable.'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleMarkPaid = (debt: { from: string; to: string; amount: number }) => {
    if (!householdId) return;
    const toMember = byId.get(debt.to);
    const label = toMember?.display_name ?? 'them';
    Alert.alert(
      'Mark as paid?',
      `Record that you paid ${label} ${formatUSD(debt.amount)}. This closes all open splits between you two for this cycle.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark paid',
          onPress: async () => {
            setBusyId(`${debt.from}:${debt.to}`);
            try {
              await settle.mutateAsync({
                householdId,
                fromMemberId: debt.from,
                toMemberId: debt.to,
                amount: debt.amount,
                method: 'other',
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Could not record.';
              Alert.alert('Failed to record', message);
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const renderDebtRow = (
    debt: { from: string; to: string; amount: number },
    perspectiveIsMine: boolean,
  ) => {
    const fromM = byId.get(debt.from);
    const toM = byId.get(debt.to);
    if (!fromM || !toM) return null;
    const key = `${debt.from}:${debt.to}`;
    const youOwe = debt.from === currentMemberId;
    const owedToYou = debt.to === currentMemberId;

    return (
      <View key={key} style={styles.debtRow}>
        <View style={styles.pair}>
          <MemberAvatar displayName={fromM.display_name} color={fromM.color} size={28} />
          <Text style={styles.arrow}>→</Text>
          <MemberAvatar displayName={toM.display_name} color={toM.color} size={28} />
        </View>
        <View style={styles.debtBody}>
          <Text style={styles.debtText}>
            {youOwe
              ? `You owe ${toM.display_name}`
              : owedToYou
                ? `${fromM.display_name} owes you`
                : `${fromM.display_name} owes ${toM.display_name}`}
          </Text>
          <Text style={styles.debtAmount}>{formatUSD(debt.amount)}</Text>
        </View>
        {perspectiveIsMine ? (
          <View style={styles.actions}>
            {youOwe ? (
              <>
                <Pressable
                  onPress={() => handlePay(debt)}
                  style={styles.linkBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.linkBtnText}>Pay</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleMarkPaid(debt)}
                  style={styles.linkBtn}
                  accessibilityRole="button"
                  disabled={busyId === key}
                >
                  <Text style={styles.linkBtnText}>
                    {busyId === key ? 'Saving\u2026' : 'Mark paid'}
                  </Text>
                </Pressable>
              </>
            ) : null}
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/balances/[memberId]',
                  params: { memberId: youOwe ? debt.to : debt.from },
                })
              }
              style={styles.linkBtn}
              accessibilityRole="button"
            >
              <Text style={styles.linkBtnText}>View expenses</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Balances' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (balances?.debts.length ?? 0) === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Everyone is settled</Text>
            <Text style={styles.emptyBody}>No outstanding balances for this cycle.</Text>
            <Button label="Back" variant="secondary" onPress={() => router.back()} />
          </View>
        ) : (
          <>
            {myDebts.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your balances</Text>
                {myDebts.map((d) => renderDebtRow(d, true))}
              </View>
            ) : null}
            {otherDebts.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Between roommates</Text>
                {otherDebts.map((d) => renderDebtRow(d, false))}
              </View>
            ) : null}
            <Pressable onPress={() => void refetch()} style={styles.refresh}>
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </>
        )}
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
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.footnote,
    color: Colors.mid,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  debtRow: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  arrow: {
    ...Typography.body,
    color: Colors.mid,
  },
  debtBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  debtText: {
    ...Typography.body,
    color: Colors.dark,
    flex: 1,
  },
  debtAmount: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.dark,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  linkBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  linkBtnText: {
    ...Typography.subhead,
    color: Colors.primary,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxxl,
  },
  emptyTitle: {
    ...Typography.title2,
    color: Colors.dark,
  },
  emptyBody: {
    ...Typography.body,
    color: Colors.mid,
    textAlign: 'center',
  },
  refresh: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
  refreshText: {
    ...Typography.subhead,
    color: Colors.primary,
  },
});
