import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';

type Props = {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  errorMessage?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
  /** Shown under the field in a muted style when disabled. */
  helperText?: string;
};

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return 'Select a date';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DateField({
  label,
  value,
  onChange,
  errorMessage,
  minimumDate,
  maximumDate,
  disabled,
  helperText,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(isoToDate(value));
  const hasError = !!errorMessage;

  const openPicker = () => {
    if (disabled) return;
    setDraft(isoToDate(value));
    setOpen(true);
  };

  const handleAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    setOpen(false);
    if (event.type === 'set' && selected) {
      onChange(dateToIso(selected));
    }
  };

  const handleIosChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (selected) setDraft(selected);
  };

  const confirmIos = () => {
    onChange(dateToIso(draft));
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={openPicker}
        disabled={disabled}
        style={[
          styles.input,
          hasError && styles.inputError,
          disabled && styles.inputDisabled,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        accessibilityLabel={label ? `${label}, ${formatDisplay(value)}` : formatDisplay(value)}
      >
        <Text style={[styles.inputText, disabled && styles.inputTextDisabled]}>
          {formatDisplay(value)}
        </Text>
      </Pressable>
      {hasError ? (
        <Text style={styles.error}>{errorMessage}</Text>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="default"
          onChange={handleAndroidChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                onChange={handleIosChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
              />
              <View style={styles.sheetActions}>
                <View style={styles.sheetAction}>
                  <Button label="Cancel" variant="secondary" onPress={() => setOpen(false)} />
                </View>
                <View style={styles.sheetAction}>
                  <Button label="Done" onPress={confirmIos} />
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

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
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  inputDisabled: {
    backgroundColor: Colors.light,
  },
  inputText: {
    ...Typography.body,
    color: Colors.dark,
  },
  inputTextDisabled: {
    color: Colors.dark,
  },
  error: {
    ...Typography.footnote,
    color: Colors.danger,
  },
  helper: {
    ...Typography.footnote,
    color: Colors.mid,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: Spacing.md,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sheetAction: {
    flex: 1,
  },
});
