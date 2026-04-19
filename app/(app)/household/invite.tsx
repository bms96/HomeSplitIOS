import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePaywallGate } from '@/components/PaywallGate';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Typography } from '@/constants/typography';
import { useCurrentHousehold, useMembers, useRotateInviteToken } from '@/hooks/useHousehold';
import { buildInviteUrl } from '@/utils/deeplinks';

const FREE_MEMBER_LIMIT = 2;

export default function InviteScreen() {
  const { data: membership } = useCurrentHousehold();
  const { data: members = [] } = useMembers(membership?.household_id);
  const rotate = useRotateInviteToken();
  const gate = usePaywallGate('third_member');
  const [toast, setToast] = useState<string | null>(null);

  const household = membership?.household;
  const inviteUrl = household ? buildInviteUrl(household.invite_token) : '';

  const shareLink = async () => {
    if (!inviteUrl) return;
    try {
      await Share.share({
        message: `Join our Homesplit household "${household!.name}": ${inviteUrl}`,
        url: Platform.OS === 'ios' ? inviteUrl : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not share link.';
      Alert.alert('Share failed', message);
    }
  };

  const handleShare = async () => {
    if (members.length >= FREE_MEMBER_LIMIT) {
      await gate(shareLink);
      return;
    }
    await shareLink();
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    await Clipboard.setStringAsync(inviteUrl);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setToast('Link copied');
  };

  const handleRotate = () => {
    if (!household) return;
    Alert.alert(
      'Generate a new invite link?',
      "The old link will stop working immediately. Anyone who hasn't joined yet will need the new link.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rotate',
          style: 'destructive',
          onPress: async () => {
            try {
              await rotate.mutateAsync(household.id);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setToast('New link generated');
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Rotate failed.';
              Alert.alert('Could not rotate link', message);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Invite roommates' }} />
      <View style={styles.inner}>
        <Text style={styles.heading}>Share this link</Text>
        <Text style={styles.body}>
          Anyone with this link can join your household. Send it to roommates via text,
          iMessage, WhatsApp, or email.
        </Text>

        <Pressable
          onPress={handleCopy}
          disabled={!inviteUrl}
          style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Tap to copy invite link${inviteUrl ? `: ${inviteUrl}` : ''}`}
        >
          <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="middle">
            {inviteUrl || 'Loading\u2026'}
          </Text>
          <Text style={styles.copyHint}>Tap to copy</Text>
        </Pressable>

        <Button label="Copy link" variant="secondary" onPress={handleCopy} disabled={!inviteUrl} />
        <Button label="Share link" onPress={handleShare} disabled={!inviteUrl} />
        <Button
          label={rotate.isPending ? 'Rotating\u2026' : 'Rotate link'}
          variant="secondary"
          onPress={handleRotate}
          loading={rotate.isPending}
          disabled={!household}
        />

        <View style={styles.spacer} />

        <Button label="Done" variant="secondary" onPress={() => router.back()} />
      </View>
      <Toast message={toast} onDismiss={() => setToast(null)} />
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
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  heading: {
    ...Typography.title2,
    color: Colors.dark,
  },
  body: {
    ...Typography.body,
    color: Colors.mid,
  },
  linkCard: {
    padding: Spacing.lg,
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  linkCardPressed: {
    opacity: 0.75,
  },
  linkText: {
    ...Typography.mono,
    color: Colors.dark,
  },
  copyHint: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
  },
});
