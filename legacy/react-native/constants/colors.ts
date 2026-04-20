import { Platform } from 'react-native';

export const Colors = {
  primary:   '#1F6FEB',
  primaryBg: '#D8E8FD',
  success:   '#16A34A',
  successBg: '#DCFCE7',
  warning:   '#D97706',
  warningBg: '#FEF3C7',
  danger:    '#DC2626',
  dangerBg:  '#FEE2E2',
  dark:      '#111827',
  mid:       '#6B7280',
  light:     '#9CA3AF',
  surface:   '#F9FAFB',
  white:     '#FFFFFF',
} as const;

export const PlatformAccent = Platform.OS === 'ios' ? '#007AFF' : '#6750A4';

export type ColorToken = keyof typeof Colors;
