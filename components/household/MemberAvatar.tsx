import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';

type Props = {
  displayName: string;
  color: string;
  size?: number;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

export function MemberAvatar({ displayName, color, size = 36 }: Props) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
      accessibilityLabel={`Avatar for ${displayName}`}
    >
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials(displayName)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...Typography.callout,
    color: Colors.white,
    fontWeight: '600',
  },
});
