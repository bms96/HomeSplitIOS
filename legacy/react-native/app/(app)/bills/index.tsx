import { router } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecurringBillCard } from '@/components/bills/RecurringBillCard';
import { usePaywallGate } from '@/components/PaywallGate';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useCurrentCycle } from '@/hooks/useExpenses';
import { useCurrentHousehold, useMembers } from '@/hooks/useHousehold';
import {
  useBillCycleAmounts,
  useBillCyclePayments,
  useRecurringBills,
} from '@/hooks/useRecurringBills';

const FREE_BILL_LIMIT = 2;

export default function BillsScreen() {
  const { data: membership } = useCurrentHousehold();
  const householdId = membership?.household_id;
  const { data: bills = [], isLoading, isError, refetch, isRefetching } =
    useRecurringBills(householdId);
  const { data: members = [] } = useMembers(householdId);
  const { data: cycle } = useCurrentCycle(householdId);
  const { data: cyclePayments = [] } = useBillCyclePayments(householdId, cycle?.id);
  const { data: cycleAmounts = [] } = useBillCycleAmounts(householdId, cycle?.id);
  const gate = usePaywallGate('third_recurring_bill');

  const openAdd = () =>
    router.push({ pathname: '/bills/[id]', params: { id: 'new' } });

  const handleAdd = async () => {
    if (bills.length >= FREE_BILL_LIMIT) {
      await gate(openAdd);
      return;
    }
    openAdd();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={bills}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={() => void refetch()}
        refreshing={isRefetching}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Recurring bills</Text>
            <Text style={styles.subtitle}>
              Posted automatically on the due date. Set once, forget about it.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => {
          const override = cycleAmounts.find((a) => a.bill_id === item.id);
          const iPaid =
            !!membership?.id &&
            cyclePayments.some(
              (p) => p.bill_id === item.id && p.member_id === membership.id,
            );
          return (
            <RecurringBillCard
              bill={item}
              members={members}
              currentMemberId={membership?.id}
              paidCount={cyclePayments.filter((p) => p.bill_id === item.id).length}
              cycleAmount={override ? Number(override.amount) : null}
              iPaid={iPaid}
              onPress={() => router.push({ pathname: '/bills/[id]', params: { id: item.id } })}
            />
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : isError ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Could not load bills</Text>
              <Button label="Retry" variant="secondary" onPress={() => void refetch()} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No recurring bills yet</Text>
              <Text style={styles.emptyBody}>
                Add rent, utilities, or the Wi-Fi bill. Homesplit posts it every cycle for you.
              </Text>
            </View>
          )
        }
      />
      <View style={styles.fabWrap} pointerEvents="box-none">
        <Button label="Add recurring bill" onPress={handleAdd} />
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
  sep: {
    height: Spacing.sm,
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
