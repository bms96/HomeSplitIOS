import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn&apos;t exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.base,
    backgroundColor: Colors.white,
    gap: Spacing.md,
  },
  title: {
    ...Typography.title2,
    color: Colors.dark,
  },
  link: {
    paddingVertical: Spacing.md,
  },
  linkText: {
    ...Typography.body,
    color: Colors.primary,
  },
});
