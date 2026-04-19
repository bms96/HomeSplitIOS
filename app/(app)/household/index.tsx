import { router } from 'expo-router';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MemberAvatar } from '@/components/household/MemberAvatar';
import { usePaywallGate } from '@/components/PaywallGate';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentHousehold, useMembers } from '@/hooks/useHousehold';

export default function HouseholdScreen() {
  const { mode, signOut } = useAuth();
  const { data: membership } = useCurrentHousehold();
  const { data: members = [] } = useMembers(membership?.household_id);
  const gate = usePaywallGate('move_out');

  const household = membership?.household;

  const handleMoveOut = () => {
    void gate(() => {
      router.push('/household/move-out');
    });
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{household?.name ?? 'Household'}</Text>
            <Text style={styles.subtitle}>
              {members.length} member{members.length === 1 ? '' : 's'}
            </Text>
            <View style={styles.quickActions}>
              <Button
                label="Settle up"
                onPress={() => router.push('/settle')}
                style={styles.flexButton}
              />
              <Button
                label="Settings"
                variant="secondary"
                onPress={() => router.push('/household/settings')}
                style={styles.flexButton}
              />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <MemberAvatar displayName={item.display_name} color={item.color} />
            <Text style={styles.memberName}>{item.display_name}</Text>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <Button
              label="Invite roommates"
              onPress={() => router.push('/household/invite')}
            />
            <Button
              label="Manage categories"
              variant="secondary"
              onPress={() => router.push('/household/categories')}
            />
            <Button label="Move out" variant="secondary" onPress={handleMoveOut} />
            {mode === 'dev-mock' ? (
              <Text style={styles.devBadge}>Dev-mock session (Supabase not configured)</Text>
            ) : null}
            <Button label="Sign out" variant="secondary" onPress={handleSignOut} />
          </View>
        }
      />
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
    paddingBottom: Spacing.xxxl,
    gap: Spacing.base,
  },
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  flexButton: {
    flex: 1,
  },
  title: {
    ...Typography.title1,
    color: Colors.dark,
  },
  subtitle: {
    ...Typography.subhead,
    color: Colors.mid,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  memberName: {
    ...Typography.body,
    color: Colors.dark,
  },
  footer: {
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  devBadge: {
    ...Typography.footnote,
    color: Colors.warning,
    textAlign: 'center',
  },
});
