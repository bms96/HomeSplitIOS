// Homesplit — process-recurring-bills Edge Function
//
// Runs once a day (triggered by pg_cron → http_post, see migration 003).
// For every active recurring bill whose next_due_date is today or in the past,
// advances next_due_date to the next occurrence and sends a push notification
// to the household. Bills no longer post synthetic expense rows — per-cycle,
// per-member payment tracking lives on bill_cycle_payments (see migration 012).
//
// Variable bills (amount IS NULL) still advance — confirming the amount is
// now just a cosmetic act for display purposes, not a precondition for
// rolling the bill forward.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

import { sendPushToHousehold } from '../_shared/push.ts';

type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'monthly_first' | 'monthly_last';

type SplitType = 'equal' | 'custom_pct' | 'custom_amt';
type ShareEntry = { member_id: string; value: number };

type RecurringBill = {
  id: string;
  household_id: string;
  name: string;
  amount: number | null;
  frequency: Frequency;
  next_due_date: string;
  active: boolean;
  split_type: SplitType;
  custom_splits: unknown;
};

function getExcludedMemberIds(customSplits: unknown): string[] {
  if (
    customSplits &&
    typeof customSplits === 'object' &&
    !Array.isArray(customSplits) &&
    Array.isArray((customSplits as { excluded_member_ids?: unknown }).excluded_member_ids)
  ) {
    return (
      (customSplits as { excluded_member_ids: unknown[] }).excluded_member_ids.filter(
        (v): v is string => typeof v === 'string',
      )
    );
  }
  return [];
}

function getShares(customSplits: unknown): ShareEntry[] {
  if (
    customSplits &&
    typeof customSplits === 'object' &&
    !Array.isArray(customSplits) &&
    Array.isArray((customSplits as { shares?: unknown }).shares)
  ) {
    return (customSplits as { shares: unknown[] }).shares.filter(
      (s): s is ShareEntry =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as { member_id?: unknown }).member_id === 'string' &&
        typeof (s as { value?: unknown }).value === 'number',
    );
  }
  return [];
}

function advanceDueDate(iso: string, frequency: Frequency): string {
  const parts = iso.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (frequency === 'weekly') {
    date.setUTCDate(date.getUTCDate() + 7);
  } else if (frequency === 'biweekly') {
    date.setUTCDate(date.getUTCDate() + 14);
  } else if (frequency === 'monthly_first') {
    const nextMonthIndex = date.getUTCMonth() + 1;
    const targetYear = date.getUTCFullYear() + Math.floor(nextMonthIndex / 12);
    const targetMonth = nextMonthIndex % 12;
    date.setUTCFullYear(targetYear, targetMonth, 1);
  } else if (frequency === 'monthly_last') {
    const nextMonthIndex = date.getUTCMonth() + 1;
    const targetYear = date.getUTCFullYear() + Math.floor(nextMonthIndex / 12);
    const targetMonth = nextMonthIndex % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    date.setUTCFullYear(targetYear, targetMonth, lastDay);
  } else {
    date.setUTCMonth(date.getUTCMonth() + 1);
  }
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

async function processBill(
  supabase: SupabaseClient,
  bill: RecurringBill,
): Promise<{ posted: boolean; reason?: string }> {
  // Active member count (post-exclusion) is used only to compute the share
  // shown in the push notification. If there are no included members we skip
  // the notification but still advance the bill.
  const { data: members, error: memberError } = await supabase
    .from('members')
    .select('id')
    .eq('household_id', bill.household_id)
    .is('left_at', null);
  if (memberError) throw memberError;
  const excluded = new Set(getExcludedMemberIds(bill.custom_splits));
  const includedMembers = (members ?? []).filter((m) => !excluded.has(m.id));
  const includedCount = includedMembers.length;
  const shares = getShares(bill.custom_splits);

  const nextDue = advanceDueDate(bill.next_due_date, bill.frequency);
  const { error: updateError } = await supabase
    .from('recurring_bills')
    .update({ next_due_date: nextDue })
    .eq('id', bill.id);
  if (updateError) throw updateError;

  try {
    let body: string;
    if (bill.amount == null) {
      body = `${bill.name} is due today — confirm the amount in the app.`;
    } else if (bill.split_type === 'custom_pct' && shares.length > 0) {
      body = `${bill.name} is due today — check the app for your share.`;
    } else if (bill.split_type === 'custom_amt' && shares.length > 0) {
      body = `${bill.name} is due today — check the app for your share.`;
    } else if (includedCount > 0) {
      const share = bill.amount / includedCount;
      body = `${bill.name} · your share is $${share.toFixed(2)}`;
    } else {
      body = `${bill.name} is due today`;
    }
    await sendPushToHousehold(supabase, bill.household_id, {
      title: `Bill due: ${bill.name}`,
      body,
      data: {
        type: 'recurring_bill_due',
        bill_id: bill.id,
        household_id: bill.household_id,
      },
    });
  } catch (err) {
    console.warn('[push] fanout failed', err);
  }

  return { posted: true };
}

Deno.serve(async (req) => {
  // Authorize — the pg_cron caller passes a shared secret in the Authorization header.
  const authHeader = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${Deno.env.get('CRON_SECRET') ?? ''}`;
  if (!Deno.env.get('CRON_SECRET') || authHeader !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'missing supabase config' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const today = new Date().toISOString().slice(0, 10);

  const { data: bills, error } = await supabase
    .from('recurring_bills')
    .select('id, household_id, name, amount, frequency, next_due_date, active, split_type, custom_splits')
    .eq('active', true)
    .lte('next_due_date', today);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const results: { bill_id: string; posted: boolean; reason?: string; error?: string }[] = [];
  for (const bill of (bills ?? []) as RecurringBill[]) {
    try {
      const res = await processBill(supabase, bill);
      results.push({ bill_id: bill.id, ...res });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ bill_id: bill.id, posted: false, error: message });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
