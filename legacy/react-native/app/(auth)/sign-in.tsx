import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useAuth } from '@/hooks/useAuth';
import { config } from '@/lib/config';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
});

type FormValues = z.infer<typeof schema>;

export default function SignInScreen() {
  const { signInWithEmail, signInAsDevUser } = useAuth();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async ({ email }: FormValues) => {
    setIsSubmitting(true);
    try {
      await signInWithEmail(email);
      setSubmittedEmail(email);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send magic link.';
      Alert.alert('Sign-in failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedEmail) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.body}>
            We sent a sign-in link to{' '}
            <Text style={styles.emphasis}>{submittedEmail}</Text>. Tap the link on this device to
            finish signing in.
          </Text>
          <Button
            label="Use a different email"
            variant="secondary"
            onPress={() => setSubmittedEmail(null)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>Homesplit</Text>
          <Text style={styles.body}>
            Sign in with your email. We&apos;ll send a magic link — no password needed.
          </Text>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value }, fieldState }) => (
              <TextField
                label="Email"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="send"
                onSubmitEditing={handleSubmit(onSubmit)}
                errorMessage={fieldState.error?.message}
              />
            )}
          />

          <Button
            label="Send magic link"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting || formState.isSubmitting}
          />

          {!config.isProd && (config.devEmail || !config.isSupabaseConfigured) ? (
            <View style={styles.devBlock}>
              <Text style={styles.devHint}>
                Dev-only: one-tap sign-in using the preconfigured account.
              </Text>
              <Button
                label="Continue as dev user"
                variant="secondary"
                onPress={() => {
                  setIsSubmitting(true);
                  void signInAsDevUser()
                    .catch((error: unknown) => {
                      const message =
                        error instanceof Error ? error.message : 'Could not sign in as dev.';
                      Alert.alert('Dev sign-in failed', message);
                    })
                    .finally(() => setIsSubmitting(false));
                }}
                accessibilityLabel="Continue as dev user (local development only)"
              />
            </View>
          ) : null}
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
  emphasis: {
    ...Typography.body,
    color: Colors.dark,
    fontWeight: '600',
  },
  devBlock: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light,
    gap: Spacing.md,
  },
  devHint: {
    ...Typography.footnote,
    color: Colors.mid,
  },
});
