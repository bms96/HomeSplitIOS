# Homesplit iOS — Backend Reference

> The Supabase backend is shared with the React Native build. Every table, RLS
> policy, RPC, trigger, and Edge Function is defined in
> `supabase/migrations/*.sql` and `supabase/functions/*`. This doc is a concise
> client-side reference — the SQL is the source of truth.

---

## Tables

### `households`
Top-level container. Columns: `id` (UUID, PK), `name` (text), `address` (text,
nullable), `cycle_start_day` (int, 1–28, default 1), `invite_token` (text, unique,
auto-generated), `timezone` (text, default `'America/New_York'`), `created_at`
(timestamptz).

### `members`
Never deleted. Columns: `id` (UUID), `household_id` (FK), `user_id` (FK
`auth.users`, nullable — member can exist pre-signup), `display_name`, `phone`,
`color` (hex), `joined_at`, `left_at` (nullable; non-null = moved out). **Always
filter active with `left_at IS NULL`.**

### `billing_cycles`
One row per household per billing period. `id`, `household_id`, `start_date`,
`end_date`, `closed_at` (null = current, non-null = archived). Unique on
`(household_id, start_date)`. Exactly one open cycle per household.

### `expenses`
One-time manual charges. Columns: `id`, `household_id`, `cycle_id`,
`paid_by_member_id`, `amount` (numeric(10,2), > 0), `description`, `category`
(`expense_category` enum), `date`, `due_date` (nullable), `recurring_bill_id`
(legacy, always NULL post-migration 012), `created_at`.

### `expense_splits`
What each member owes on each expense. `id`, `expense_id`, `member_id`,
`amount_owed` (numeric(10,2), ≥ 0), `settled_at` (null = outstanding),
`settlement_id` (FK). Unique `(expense_id, member_id)`.

### `recurring_bills`
Templates for recurring charges. `id`, `household_id`, `name`, `amount`
(nullable = variable), `frequency` (`bill_cycle_frequency` enum),
`next_due_date`, `active`, `split_type` (`split_type` enum), `custom_splits`
(jsonb: `{ shares: [{member_id, value}], excluded_member_ids: [uuid] }`).

### `bill_cycle_amounts`
Per-cycle amount override. Required for variable bills before anyone can mark
paid. `id`, `bill_id`, `cycle_id`, `amount`, `updated_at`. Unique
`(bill_id, cycle_id)`.

### `bill_cycle_payments`
Per-member-per-cycle paid marker. `id`, `bill_id`, `cycle_id`, `member_id`,
`settled_at`, `created_at`. Unique `(bill_id, cycle_id, member_id)`. Absence =
unpaid.

### `settlements`
One member paying another. `id`, `household_id`, `cycle_id` (nullable),
`from_member_id`, `to_member_id`, `amount`, `method` (`settlement_method` enum),
`notes`, `settled_at`. `from != to` check.

### `move_outs`
Formal departure record. `id`, `household_id`, `departing_member_id`,
`move_out_date`, `prorated_days_present`, `cycle_total_days`,
`settlement_amount` (nullable; positive = household owes them),
`settlement_id`, `pdf_url`, `completed_at`.

### `subscriptions`
Household subscription status, written by RevenueCat webhook (server-side).
Client reads only. `id`, `household_id` (unique), `status`
(`subscription_status` enum), `revenuecat_id`, `product_id`, `expires_at`,
`updated_at`.

### `push_tokens`
Per-user-per-device APNs/FCM token. `id`, `user_id`, `token`, `platform`
(`'ios' | 'android' | 'web'`), `created_at`, `updated_at`. Unique
`(user_id, token)`. Users can manage only their own via RLS.

### `expense_category_preferences`
Per-household customization of the fixed `expense_category` enum. PK
`(household_id, category)`. Columns: `hidden`, `custom_label`, `updated_at`.

---

## Enums

| Enum | Values |
|---|---|
| `bill_cycle_frequency` | `weekly`, `biweekly`, `monthly`, `monthly_first`, `monthly_last` |
| `split_type` | `equal`, `custom_pct`, `custom_amt` |
| `expense_category` | `rent`, `utilities`, `groceries`, `household`, `food`, `transport`, `other` |
| `settlement_method` | `venmo`, `cashapp`, `cash`, `other` |
| `subscription_status` | `active`, `expired`, `cancelled`, `trial` |

Model them in Swift as `String`-backed enums conforming to `Codable, CaseIterable,
Identifiable, Sendable`.

---

## RLS policies (the shape the client sees)

- `households`: select/update gated by `is_household_member(id)`. Insert allowed
  for any authenticated user (creating a household).
- `members`: select via `was_household_member(household_id)` (lets moved-out
  members still see the member list); insert/update gated by
  `is_household_member(household_id)` OR self-update (`user_id = auth.uid()`).
- `billing_cycles`: select only — cycles are created by Edge Function /
  `close_and_open_cycle` RPC.
- `expenses`, `recurring_bills`, `expense_category_preferences`, `bill_cycle_*`,
  `settlements`: full CRUD for active members. **`settlements.insert` also
  requires `from_member_id` to belong to the caller** (can't settle *as* someone
  else).
- `move_outs`: select via `was_household_member`; insert/update gated by active
  membership.
- `subscriptions`: select only (RC webhook writes).
- `push_tokens`: full CRUD scoped to `user_id = auth.uid()`.

Denials look like HTTP 403 with `PGRST`-prefixed codes. Decode as
`HomesplitError.notAuthorized`.

---

## RPCs the client can call

| Function | Inputs | Output | Notes |
|---|---|---|---|
| `create_household(name, display_name, address?, timezone?, cycle_start_day?)` | strings + int | `uuid` (household_id) | Atomically creates household, first member, first cycle, subscription row. SECURITY DEFINER. |
| `join_household_by_token(token)` | text | `uuid` (household_id) | Creates or reactivates the caller as a member. |
| `rotate_invite_token(hid)` | uuid | `text` (new token) | Invalidates old invite link. |
| `settle_pair(p_household_id, p_from_member_id, p_to_member_id, p_amount, p_method?, p_notes?)` | uuids + numeric + enum + text | `uuid` (settlement_id) | Inserts a `settlements` row and marks affected splits settled. |
| `complete_move_out(p_household_id, p_member_id, p_move_out_date)` | uuid + date | `uuid` (move_out_id) | Prorates current-cycle splits, redistributes, sets `members.left_at`, inserts `move_outs` row. |
| `close_and_open_cycle(hid)` | uuid | `uuid` (new cycle_id) | Called by the daily cron; client won't invoke directly. |
| `is_household_member(hid)`, `was_household_member(hid)` | uuid | bool | Helpers used in RLS; don't call from the client. |

---

## Triggers

- `bcp_enforce_amount` (migration 013) — BEFORE INSERT on
  `bill_cycle_payments`. Raises if the bill has a NULL `amount` and no
  `bill_cycle_amounts` override. Guards variable bills.
- `bca_touch_updated_at` (migration 013) — BEFORE UPDATE on
  `bill_cycle_amounts`. Maintains `updated_at`.
- `bcp_advance_on_full_payment` (migrations 014 / 015 / 016 / 018) — AFTER
  INSERT on `bill_cycle_payments`. When every included member has marked paid
  AND `next_due_date <= current_date`, advances `next_due_date` (with
  end-of-month clamping for monthly / monthly_first / monthly_last) and clears
  that cycle's payment rows.

---

## Views

- `member_balances` — per-member, current-cycle net balance. `member_id`,
  `household_id`, `display_name`, `color`, `total_paid`, `total_owed`,
  `net_balance`. Convenient for the dashboard, but the iOS app may prefer to
  compute balances client-side from raw splits to support the payer-self-split
  filter and simplification.
- `member_push_tokens` — joins active members to their push tokens for the
  Edge Functions. Not used by the client.

---

## Edge Functions

### `process-recurring-bills`

- Trigger: pg_cron → `net.http_post` at 03:15 UTC daily (migration 003).
- Auth: `Authorization: Bearer CRON_SECRET`.
- Behavior: for each active recurring bill with `next_due_date <= today`,
  advances the date and pushes "`<bill name>` is due" to the household.
- **Known issue** (TODO in RN repo): uses `Date.setUTCMonth(+1)` for monthly,
  which overflows (Jan 31 → Mar 3). The SQL trigger in migration 014 uses
  end-of-month clamping (Jan 31 → Feb 28). Unify by porting
  `utils/billFrequency.ts::advanceDueDate` (now
  `Domain/BillFrequency/BillFrequency.swift`) back into the Edge Function.
  Don't change the trigger.

### `send-settle-reminder`

- Trigger: pg_cron at 09:00 UTC every Sunday (migration 006).
- Auth: `Authorization: Bearer CRON_SECRET`.
- Behavior: for each household with ≥ 1 unsettled split in the current cycle,
  sends a "Time to settle up" push.

---

## Client-side enforcement checklist

Server will reject these via triggers / RLS, but catch them in the client for a
better UX:

- Amount > 0 on add expense / set cycle amount.
- `included_member_ids` non-empty on add expense.
- For variable bills: block "Mark paid" until a `bill_cycle_amounts` row exists.
- For custom % split: UI enforces shares sum to 100 (server doesn't).
- For custom $ split: UI enforces shares sum to amount (server doesn't).
- Move-out date ≥ cycle start.
- `from_member_id != to_member_id` on manual "Mark paid between pair" flows.

---

## Storage

Bucket `settlement-pdfs`. Path format
`{household_id}/{move_out_id}.pdf`. Read policy allows only household members
(see migration for `storage.objects` policy). Upload the PDF at the end of the
move-out flow; store the URL on `move_outs.pdf_url`.

---

## Notes on timezones

- `households.timezone` is the IANA name (e.g., `America/Los_Angeles`).
- Dates stored as `date` (e.g., `start_date`, `end_date`, `next_due_date`) are
  **calendar dates in the household's timezone**. Don't assume UTC.
- When constructing ISO strings in Swift, format as
  `"yyyy-MM-dd"` with the household's `TimeZone`. Never pass a full ISO
  datetime where the column is `date`.
