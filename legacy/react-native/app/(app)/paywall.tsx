import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import {
  isExpoGo,
  isRevenueCatAvailable,
  presentCustomerCenter,
  presentPaywall,
} from '@/lib/revenuecat';

export default function PaywallScreen() {
  const available = !isExpoGo && isRevenueCatAvailable();

  useEffect(() => {
    if (!available) return;
    void presentPaywall().then((result) => {
      if (result === 'purchased') {
        router.back();
      } else if (result === 'cancelled' || result === 'error') {
        router.back();
      }
    });
  }, [available]);

  if (available) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: true, title: 'Upgrade' }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Upgrade' }} />
      <View style={styles.inner}>
        <Text style={styles.title}>Homesplit Pro</Text>
        <Text style={styles.body}>
          Unlock unlimited members, unlimited recurring bills, and the automated move-out
          flow.
        </Text>
        <Text style={styles.helper}>
          The paywall requires a development build — it can&apos;t run in Expo Go. Once you
          install the dev client, tapping Upgrade will show real RevenueCat offerings.
        </Text>
        <Button
          label="Manage subscription"
          variant="secondary"
          onPress={async () => {
            const result = await presentCustomerCenter();
            if (result === 'unavailable') {
              Alert.alert(
                'Unavailable',
                'Customer center requires a development build.',
              );
            }
          }}
        />
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
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
    padding: Spacing.base,
    gap: Spacing.md,
    justifyContent: 'center',
  },
  title: {
    ...Typography.title1,
    color: Colors.dark,
  },
  body: {
    ...Typography.body,
    color: Colors.dark,
  },
  helper: {
    ...Typography.footnote,
    color: Colors.mid,
  },
});
