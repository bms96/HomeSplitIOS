import { forwardRef } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';

type Props = {
  label?: string;
  errorMessage?: string;
} & TextInputProps;

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, errorMessage, style, ...rest },
  ref,
) {
  const hasError = !!errorMessage;
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={Colors.light}
        style={[styles.input, hasError && styles.inputError, style]}
        accessibilityLabel={label}
        {...rest}
      />
      {hasError ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.subhead,
    color: Colors.mid,
  },
  input: {
    height: Platform.OS === 'ios' ? 48 : 56,
    borderWidth: 1,
    borderColor: Colors.light,
    borderRadius: Platform.OS === 'ios' ? 10 : 4,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Colors.dark,
    backgroundColor: Colors.white,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  error: {
    ...Typography.footnote,
    color: Colors.danger,
  },
});
