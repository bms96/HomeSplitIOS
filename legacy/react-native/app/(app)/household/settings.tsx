import { useQueryClient } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useAuth } from '@/hooks/useAuth';
import {
  useCurrentHousehold,
  useMembers,
  useUpdateHouseholdName,
  useUpdateMemberDisplayName,
} from '@/hooks/useHousehold';
import { supabase } from '@/lib/supabase';
import { useDevStore } from '@/stores/devStore';

export default function HouseholdSettingsScreen() {
  const { data: membership } = useCurrentHousehold();
  const updateName = useUpdateHouseholdName();
  const updateDisplay = useUpdateMemberDisplayName();

  const [householdName, setHouseholdName] = useState('');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (membership) {
      setHouseholdName(membership.household.name);
      setDisplayName(membership.display_name);
    }
  }, [membership]);

  const canSave =
    !!membership &&
    ((householdName.trim() && householdName.trim() !== membership.household.name) ||
      (displayName.trim() && displayName.trim() !== membership.display_name));

  const onSave = async () => {
    if (!membership) return;
    try {
      const tasks: Promise<unknown>[] = [];
      const hname = householdName.trim();
      const dname = displayName.trim();
      if (hname && hname !== membership.household.name) {
        tasks.push(
          updateName.mutateAsync({ householdId: membership.household_id, name: hname }),
        );
      }
      if (dname && dname !== membership.display_name) {
        tasks.push(
          updateDisplay.mutateAsync({ memberId: membership.id, displayName: dname }),
        );
      }
      await Promise.all(tasks);
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save.';
      Alert.alert('Could not save', message);
    }
  };

  const busy = updateName.isPending || updateDisplay.isPending;

  const queryClient = useQueryClient();
  const [resetting, setResetting] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const { user } = useAuth();
  const impersonatedMemberId = useDevStore((s) => s.impersonatedMemberId);
  const setImpersonatedMemberId = useDevStore((s) => s.setImpersonatedMemberId);
  const { data: members = [] } = useMembers(membership?.household_id);

  const onSwitchMember = async (targetId: string, targetName: string, needsLink: boolean) => {
    if (!user?.id || switching) return;
    setSwitching(targetId);
    try {
      if (needsLink) {
        const { error } = await supabase
          .from('members')
          .update({ user_id: user.id })
          .eq('id', targetId);
        if (error) throw error;
      }
      setImpersonatedMemberId(targetId);
      await queryClient.invalidateQueries();
      Alert.alert('Switched', `You are now viewing as ${targetName}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not switch.';
      Alert.alert('Could not switch', message);
    } finally {
      setSwitching(null);
    }
  };

  const onClearImpersonation = async () => {
    setImpersonatedMemberId(null);
    await queryClient.invalidateQueries();
  };

  const onResetData = () => {
    if (!membership) return;
    const householdId = membership.household_id;
    Alert.alert(
      'Reset all data?',
      'Deletes every expense, split, recurring bill, and settlement in this household. Members and billing cycles are kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              const [settlements, bills, expenses] = await Promise.all([
                supabase.from('settlements').delete().eq('household_id', householdId),
                supabase.from('recurring_bills').delete().eq('household_id', householdId),
                supabase.from('expenses').delete().eq('household_id', householdId),
              ]);
              const firstError = settlements.error ?? bills.error ?? expenses.error;
              if (firstError) throw firstError;
              await queryClient.invalidateQueries();
              Alert.alert('Reset complete', 'All expenses and bills were deleted.');
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Reset failed.';
              Alert.alert('Could not reset', message);
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Settings' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>Household</Text>
          <TextField
            label="Name"
            value={householdName}
            onChangeText={setHouseholdName}
            autoCapitalize="words"
            placeholder="The apartment"
          />

          <Text style={styles.sectionLabel}>You</Text>
          <TextField
            label="Your display name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            placeholder="Alex"
          />

          {__DEV__ ? (
            <View style={styles.devSection}>
              <Text style={styles.sectionLabel}>Developer</Text>

              <Text style={styles.devHelper}>
                View the app as another member. If the member has no account, their row
                gets linked to your auth user so writes pass RLS.
              </Text>
              {impersonatedMemberId ? (
                <Button
                  label="Return to my account"
                  variant="secondary"
                  onPress={onClearImpersonation}
                />
              ) : null}
              {members
                .filter((m) => m.id !== membership?.id || impersonatedMemberId != null)
                .map((m) => {
                  const isCurrent = m.id === membership?.id;
                  const needsLink = m.user_id == null;
                  return (
                    <Button
                      key={m.id}
                      label={
                        switching === m.id
                          ? 'Switching\u2026'
                          : isCurrent
                            ? `${m.display_name} (current)`
                            : `Switch to ${m.display_name}${needsLink ? ' (link & switch)' : ''}`
                      }
                      variant="secondary"
                      onPress={() => onSwitchMember(m.id, m.display_name, needsLink)}
                      loading={switching === m.id}
                      disabled={switching !== null || isCurrent}
                    />
                  );
                })}

              <Text style={[styles.devHelper, styles.devHelperSpaced]}>
                Deletes every expense, split, recurring bill, and settlement in this household.
                Members and cycles stay.
              </Text>
              <Button
                label={resetting ? 'Resetting\u2026' : 'Reset expense & bill data'}
                variant="secondary"
                onPress={onResetData}
                loading={resetting}
                disabled={resetting || !membership}
              />
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={busy ? 'Saving\u2026' : 'Save'}
            onPress={onSave}
            loading={busy}
            disabled={!canSave || busy}
          />
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
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  sectionLabel: {
    ...Typography.footnote,
    color: Colors.mid,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: Spacing.sm,
  },
  footer: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
  devSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
    gap: Spacing.sm,
  },
  devHelper: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  devHelperSpaced: {
    marginTop: Spacing.md,
  },
});
