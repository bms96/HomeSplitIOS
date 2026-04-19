// Shared Expo push sender. Used by both the standalone `send-push` function
// (for ad-hoc sends) and other cron functions that want to notify members.
//
// Expo's push service: https://docs.expo.dev/push-notifications/sending-notifications/
// - POST https://exp.host/--/api/v2/push/send with an array of up to 100 messages
// - Each message: { to, title, body, data?, sound?, badge?, channelId? }

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
};

type ExpoMessage = PushPayload & { to: string };

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

export async function sendPushToHousehold(
  supabase: SupabaseClient,
  householdId: string,
  payload: PushPayload,
  options: { excludeMemberIds?: string[] } = {},
): Promise<{ sent: number; failed: number }> {
  const exclude = new Set(options.excludeMemberIds ?? []);

  const { data: rows, error } = await supabase
    .from('member_push_tokens')
    .select('member_id, token')
    .eq('household_id', householdId);
  if (error) throw error;

  const tokens = (rows ?? [])
    .filter((r: { member_id: string }) => !exclude.has(r.member_id))
    .map((r: { token: string }) => r.token);

  return sendPushToTokens(tokens, payload);
}

export async function sendPushToUsers(
  supabase: SupabaseClient,
  userIds: string[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (userIds.length === 0) return { sent: 0, failed: 0 };
  const { data: rows, error } = await supabase
    .from('push_tokens')
    .select('token')
    .in('user_id', userIds);
  if (error) throw error;
  const tokens = (rows ?? []).map((r: { token: string }) => r.token);
  return sendPushToTokens(tokens, payload);
}

export async function sendPushToTokens(
  tokens: string[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  const messages: ExpoMessage[] = tokens.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: payload.sound ?? 'default',
  }));

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'accept-encoding': 'gzip, deflate',
          'content-type': 'application/json',
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        failed += batch.length;
        continue;
      }
      const json = (await res.json()) as { data?: { status: string }[] };
      for (const r of json.data ?? []) {
        if (r.status === 'ok') sent += 1;
        else failed += 1;
      }
    } catch {
      failed += batch.length;
    }
  }

  return { sent, failed };
}
