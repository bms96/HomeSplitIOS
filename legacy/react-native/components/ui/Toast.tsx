import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';

type Props = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
};

export function Toast({ message, onDismiss, durationMs = 2000 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        () => onDismiss(),
      );
    }, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onDismiss, opacity]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none" accessibilityLiveRegion="polite">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: Spacing.xxl,
    left: Spacing.base,
    right: Spacing.base,
    backgroundColor: Colors.dark,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  text: {
    ...Typography.subhead,
    color: Colors.white,
    fontWeight: '600',
  },
});
