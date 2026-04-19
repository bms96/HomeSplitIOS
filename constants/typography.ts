import { Platform, type TextStyle } from 'react-native';

export const Typography = {
  display:  { fontSize: 34, fontWeight: '700', lineHeight: 41 },
  title1:   { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  title2:   { fontSize: 22, fontWeight: '600', lineHeight: 28 },
  title3:   { fontSize: 20, fontWeight: '600', lineHeight: 25 },
  body:     { fontSize: 17, fontWeight: '400', lineHeight: 22 },
  callout:  { fontSize: 16, fontWeight: '400', lineHeight: 21 },
  subhead:  { fontSize: 15, fontWeight: '400', lineHeight: 20 },
  footnote: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  caption:  { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  mono:     { fontSize: 15, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof Typography;
