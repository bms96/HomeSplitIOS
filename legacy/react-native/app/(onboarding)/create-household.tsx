import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useCreateHousehold } from '@/hooks/useHousehold';

const schema = z.object({
  householdName: z
    .string()
    .min(1, 'Give your household a name')
    .max(60, 'Keep it under 60 characters'),
  displayName: z.string().min(1, 'Your name is required').max(40),
});

type FormValues = z.infer<typeof schema>;

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/New_York';
  } catch {
    return 'America/New_York';
  }
}

function todaysCycleStartDay(): number {
  const day = new Date().getDate();
  return Math.min(day, 28);
}

export default function CreateHouseholdScreen() {
  const createHousehold = useCreateHousehold();

  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { householdName: '', displayName: '' },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createHousehold.mutateAsync({
        name: values.householdName.trim(),
        displayName: values.displayName.trim(),
        timezone: deviceTimezone(),
        cycleStartDay: todaysCycleStartDay(),
      });
      router.replace('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create household.';
      Alert.alert('Create household failed', message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>Set up your household</Text>
          <Text style={styles.body}>
            Name it something your roommates will recognize. You&apos;ll invite them next.
          </Text>

          <Controller
            control={control}
            name="householdName"
            render={({ field: { onChange, onBlur, value }, fieldState }) => (
              <TextField
                label="Household name"
                placeholder="Maple Street House"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="words"
                returnKeyType="next"
                errorMessage={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="displayName"
            render={({ field: { onChange, onBlur, value }, fieldState }) => (
              <TextField
                label="Your name"
                placeholder="Alex"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleSubmit(onSubmit)}
                errorMessage={fieldState.error?.message}
              />
            )}
          />

          <Button
            label="Create household"
            onPress={handleSubmit(onSubmit)}
            loading={createHousehold.isPending || formState.isSubmitting}
          />
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
  flex: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.base,
    gap: Spacing.lg,
  },
  title: {
    ...Typography.title1,
    color: Colors.dark,
  },
  body: {
    ...Typography.body,
    color: Colors.mid,
  },
});
