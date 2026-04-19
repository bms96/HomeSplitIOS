import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import {
  DEFAULT_CATEGORY_LABELS,
  DEFAULT_HIDDEN_CATEGORIES,
  mergeCategoryDisplay,
  useCategoryPreferences,
  useSaveCategoryPreference,
} from '@/hooks/useCategoryPreferences';
import { useCurrentHousehold } from '@/hooks/useHousehold';
import type { Database } from '@/types/database';

type Category = Database['public']['Enums']['expense_category'];

export default function CategoriesScreen() {
  const { data: membership } = useCurrentHousehold();
  const householdId = membership?.household_id;
  const { data: prefs = [], isLoading } = useCategoryPreferences(householdId);
  const save = useSaveCategoryPreference();

  const [editing, setEditing] = useState<Category | null>(null);
  const [draftLabel, setDraftLabel] = useState('');

  const categories = useMemo(() => mergeCategoryDisplay(prefs), [prefs]);

  const toggleHidden = async (category: Category, hidden: boolean) => {
    if (!householdId) return;
    const existing = prefs.find((p) => p.category === category);
    try {
      await save.mutateAsync({
        householdId,
        category,
        hidden,
        customLabel: existing?.custom_label ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save.';
      Alert.alert('Could not save', message);
    }
  };

  const startRename = (category: Category, currentLabel: string) => {
    setEditing(category);
    setDraftLabel(currentLabel);
  };

  const commitRename = async () => {
    if (!householdId || !editing) return;
    const trimmed = draftLabel.trim();
    const existing = prefs.find((p) => p.category === editing);
    const isDefaultHidden = DEFAULT_HIDDEN_CATEGORIES.includes(editing);
    const customLabel =
      trimmed && trimmed !== DEFAULT_CATEGORY_LABELS[editing] ? trimmed : null;
    try {
      await save.mutateAsync({
        householdId,
        category: editing,
        hidden: existing ? existing.hidden : isDefaultHidden,
        customLabel,
      });
      setEditing(null);
      setDraftLabel('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save.';
      Alert.alert('Could not save', message);
    }
  };

  const resetRename = async (category: Category) => {
    if (!householdId) return;
    const existing = prefs.find((p) => p.category === category);
    const isDefaultHidden = DEFAULT_HIDDEN_CATEGORIES.includes(category);
    try {
      await save.mutateAsync({
        householdId,
        category,
        hidden: existing ? existing.hidden : isDefaultHidden,
        customLabel: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reset.';
      Alert.alert('Could not reset', message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Categories' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Rename or hide categories for this household. Hidden categories won&apos;t appear
            when adding expenses. Existing expenses keep their category.
          </Text>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : null}

          {categories.map((cat) => {
            const isEditing = editing === cat.value;
            const defaultLabel = DEFAULT_CATEGORY_LABELS[cat.value];
            const isCustom = cat.label !== defaultLabel;
            return (
              <View key={cat.value} style={styles.row}>
                <View style={styles.rowBody}>
                  {isEditing ? (
                    <TextInput
                      value={draftLabel}
                      onChangeText={setDraftLabel}
                      onBlur={commitRename}
                      onSubmitEditing={commitRename}
                      placeholder={defaultLabel}
                      style={styles.input}
                      autoFocus
                      returnKeyType="done"
                      maxLength={40}
                    />
                  ) : (
                    <Pressable
                      onPress={() => startRename(cat.value, cat.label)}
                      accessibilityRole="button"
                      accessibilityLabel={`Rename ${cat.label}`}
                    >
                      <Text style={styles.name}>{cat.label}</Text>
                      {isCustom ? (
                        <Text style={styles.subLabel}>Default: {defaultLabel}</Text>
                      ) : (
                        <Text style={styles.subLabel}>Tap to rename</Text>
                      )}
                    </Pressable>
                  )}
                </View>
                {isCustom && !isEditing ? (
                  <Pressable
                    onPress={() => resetRename(cat.value)}
                    accessibilityRole="button"
                    accessibilityLabel="Reset to default"
                    hitSlop={8}
                  >
                    <Text style={styles.reset}>Reset</Text>
                  </Pressable>
                ) : null}
                <Switch
                  value={!cat.hidden}
                  onValueChange={(v) => toggleHidden(cat.value, !v)}
                  accessibilityLabel={`${cat.label} visible`}
                />
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Done" variant="secondary" onPress={() => router.back()} />
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
    gap: Spacing.sm,
  },
  intro: {
    ...Typography.footnote,
    color: Colors.mid,
    marginBottom: Spacing.sm,
  },
  loading: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Typography.body,
    color: Colors.dark,
    fontWeight: '600',
  },
  subLabel: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  input: {
    ...Typography.body,
    color: Colors.dark,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
    paddingVertical: 4,
  },
  reset: {
    ...Typography.footnote,
    color: Colors.primary,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
});
