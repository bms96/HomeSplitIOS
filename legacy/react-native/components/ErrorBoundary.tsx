import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected error. Tap reload to try again.
        </Text>
        {__DEV__ ? (
          <Text style={styles.debug} numberOfLines={4}>
            {this.state.error.message}
          </Text>
        ) : null}
        <Pressable
          onPress={this.reset}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="Reload the app"
        >
          <Text style={styles.buttonLabel}>Reload</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
    backgroundColor: Colors.white,
  },
  title: {
    ...Typography.title2,
    color: Colors.dark,
    textAlign: 'center',
  },
  body: {
    ...Typography.body,
    color: Colors.mid,
    textAlign: 'center',
  },
  debug: {
    ...Typography.footnote,
    color: Colors.danger,
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  buttonLabel: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
});
