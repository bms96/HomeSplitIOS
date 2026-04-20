import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const [error, setError] = useState<string | null>(null);
  const url = Linking.useURL();

  useEffect(() => {
    if (!url) return;

    const complete = async () => {
      try {
        const fragment = url.split('#')[1] ?? '';
        const params = new URLSearchParams(fragment);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (!accessToken || !refreshToken) {
          throw new Error('Sign-in link is missing tokens. Request a new one.');
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;

        router.replace('/');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sign-in failed.');
      }
    };

    void complete();
  }, [url]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {error ? (
          <>
            <Text style={styles.title}>Couldn&apos;t sign you in</Text>
            <Text style={styles.body}>{error}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.body}>Finishing sign-in…</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  title: {
    ...Typography.title2,
    color: Colors.dark,
  },
  body: {
    ...Typography.body,
    color: Colors.mid,
    textAlign: 'center',
  },
});
