import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import type { Database } from '@/types/database';

type Category = Database['public']['Enums']['expense_category'];

const GLYPH: Record<Category, string> = {
  rent: '🏠',
  utilities: '💡',
  groceries: '🛒',
  household: '🧺',
  food: '🍽',
  transport: '🚗',
  other: '•',
};

type Props = {
  category: Category;
  size?: number;
};

export function CategoryIcon({ category, size = 36 }: Props) {
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.glyph, { fontSize: size * 0.5 }]}>{GLYPH[category]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  glyph: {
    textAlign: 'center',
  },
});
