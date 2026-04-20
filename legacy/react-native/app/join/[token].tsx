import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useAuth } from '@/hooks/useAuth';
import { useJoinHousehold } from '@/hooks/useHousehold';

export default function JoinHouseholdScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { isInitialized, isSignedIn } = useAuth();
  const join = useJoinHousehold();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isInitialized || !isSignedIn || !token || done || join.isPending) return;
    join.mutateAsync(token)
      .then(() => setDone(true))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not join household.'));
  }, [isInitialized, isSignedIn, token, done, join]);

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  if (done) {
    return <Redirect href="/" />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Join household' }} />
      <View style={styles.inner}>
        {error ? (
          <>
            <Text style={styles.title}>Couldn&apos;t join</Text>
            <Text style={styles.body}>{error}</Text>
            <Button label="Back" variant="secondary" onPress={() => router.replace('/')} />
          </>
        ) : (
          <>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.body}>Joining household…</Text>
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
