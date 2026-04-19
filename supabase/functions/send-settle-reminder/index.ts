// Homesplit — send-settle-reminder Edge Function
//
// Fires weekly (Sunday 9am) via pg_cron. For each household with unsettled
// balances this cycle, notifies every active member: "Time to settle up."
// Detailed per-member balance math lives client-side (useBalances) — the
// notification just drives them into the app.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

import { sendPushToHousehold } from '../_shared/push.ts';

type HouseholdWithUnsettled = { household_id: string };

async function householdsWithUnsettled(supabase: SupabaseClient): Promise<string[]> {
  // Households that have at least one unsettled split on an expense in the
  // currently open cycle. This is conservative — a household with only fully-
  // settled splits won't get pinged.
  const { data, error } = await supabase
    .from('expense_splits')
    .select('expenses!inner(household_id, billing_cycles!inner(closed_at))')
    .is('settled_at', null)
    .is('expenses.billing_cycles.closed_at', null);
  if (error) throw error;

  const ids = new Set<string>();
  for (const row of ((data ?? []) as unknown[]) as { expenses: HouseholdWithUnsettled }[]) {
    const hid = row.expenses?.household_id;
    if (hid) ids.add(hid);
  }
  return [...ids];
}

Deno.serve(async (req) => {
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

  const householdIds = await householdsWithUnsettled(supabase);

  const results: { household_id: string; sent: number; failed: number }[] = [];
  for (const householdId of householdIds) {
    const { sent, failed } = await sendPushToHousehold(supabase, householdId, {
      title: 'Time to settle up',
      body: 'Open Homesplit to see who owes what this cycle.',
      data: { type: 'settle_reminder', household_id: householdId },
    });
    results.push({ household_id: householdId, sent, failed });
  }

  return new Response(
    JSON.stringify({ households: householdIds.length, results }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
