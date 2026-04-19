-- =============================================================================
-- Homesplit — Initial Schema Migration
-- File: supabase/migrations/001_initial_schema.sql
-- Run: npx supabase db push --project-ref YOUR_DEV_REF
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_cron";    -- recurring bill scheduler (enable in Dashboard → Extensions first)

-- ---------------------------------------------------------------------------
-- Custom Types (Enums)
-- ---------------------------------------------------------------------------
create type bill_cycle_frequency as enum ('weekly', 'biweekly', 'monthly');
create type split_type            as enum ('equal', 'custom_pct', 'custom_amt');
create type expense_category      as enum ('rent', 'utilities', 'groceries', 'household', 'food', 'transport', 'other');
create type settlement_method     as enum ('venmo', 'cashapp', 'cash', 'other');
create type subscription_status   as enum ('active', 'expired', 'cancelled', 'trial');

-- ---------------------------------------------------------------------------
-- HOUSEHOLDS
-- The top-level container. Every other table references this.
-- ---------------------------------------------------------------------------
create table households (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  address          text,
  cycle_start_day  int  not null default 1   check (cycle_start_day between 1 and 28),
  invite_token     text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  timezone         text not null default 'America/New_York',  -- IANA tz name
  created_at       timestamptz not null default now()
);

comment on column households.cycle_start_day is
  'Day of month the billing cycle resets (1–28; capped at 28 to avoid month-end edge cases)';
comment on column households.timezone is
  'IANA timezone for cycle rollover cron — all stored timestamps remain UTC';

-- ---------------------------------------------------------------------------
-- MEMBERS
-- One row per person per household. Never deleted — use left_at for move-outs.
-- ---------------------------------------------------------------------------
create table members (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,  -- nullable: can invite before signup
  display_name    text not null,
  phone           text,
  color           text not null default '#6B7280',  -- hex for avatar background
  joined_at       timestamptz not null default now(),
  left_at         timestamptz                        -- set on move-out; never delete the row
);

comment on column members.user_id is
  'Nullable — a member slot can be created via invite before the person creates an account';
comment on column members.left_at is
  'Non-null means this person has moved out. Filter with: WHERE left_at IS NULL';

create index idx_members_household on members(household_id);
create index idx_members_user      on members(user_id);

-- ---------------------------------------------------------------------------
-- BILLING CYCLES
-- One row per calendar period per household.
-- Created automatically by the Edge Function on cycle_start_day.
-- ---------------------------------------------------------------------------
create table billing_cycles (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  start_date   date not null,
  end_date     date not null,
  closed_at    timestamptz,   -- null = current cycle; non-null = archived
  created_at   timestamptz not null default now(),
  unique (household_id, start_date)
);

create index idx_cycles_household on billing_cycles(household_id);

-- ---------------------------------------------------------------------------
-- RECURRING BILLS
-- Templates — one row per bill type. The Edge Function posts expenses from these.
-- ---------------------------------------------------------------------------
create table recurring_bills (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  name           text not null,
  amount         numeric(10,2),         -- null = variable; user confirms each cycle
  split_type     split_type not null default 'equal',
  custom_splits  jsonb,                  -- [{member_id, value}] for custom splits
  frequency      bill_cycle_frequency not null default 'monthly',
  active         boolean not null default true,
  next_due_date  date not null,
  created_at     timestamptz not null default now()
);

comment on column recurring_bills.amount is
  'Null = variable amount. Edge Function sends a push notification requesting confirmation before posting.';
comment on column recurring_bills.custom_splits is
  'Only populated when split_type != equal. JSON array: [{member_id: uuid, value: number}]. '
  'For custom_pct: values are percentages (must sum to 100). For custom_amt: values are dollar amounts (must sum to bill amount).';

create index idx_recurring_household on recurring_bills(household_id);
create index idx_recurring_active    on recurring_bills(household_id, active, next_due_date);

-- ---------------------------------------------------------------------------
-- EXPENSES
-- One row per posted charge (manual or auto-posted from recurring_bills).
-- ---------------------------------------------------------------------------
create table expenses (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references households(id) on delete cascade,
  cycle_id             uuid not null references billing_cycles(id),
  paid_by_member_id    uuid not null references members(id),
  amount               numeric(10,2) not null check (amount > 0),
  description          text not null,
  category             expense_category not null default 'other',
  date                 date not null default current_date,
  recurring_bill_id    uuid references recurring_bills(id) on delete set null,  -- non-null = auto-posted
  created_at           timestamptz not null default now()
);

create index idx_expenses_household on expenses(household_id, cycle_id);
create index idx_expenses_cycle     on expenses(cycle_id);
create index idx_expenses_payer     on expenses(paid_by_member_id);

-- ---------------------------------------------------------------------------
-- EXPENSE SPLITS
-- One row per member per expense — what each person owes.
-- ---------------------------------------------------------------------------
create table expense_splits (
  id            uuid primary key default gen_random_uuid(),
  expense_id    uuid not null references expenses(id) on delete cascade,
  member_id     uuid not null references members(id),
  amount_owed   numeric(10,2) not null check (amount_owed >= 0),
  settled_at    timestamptz,     -- null = outstanding; non-null = settled
  settlement_id uuid,            -- FK added below after settlements table
  unique (expense_id, member_id)
);

create index idx_splits_expense    on expense_splits(expense_id);
create index idx_splits_member     on expense_splits(member_id);
create index idx_splits_unsettled  on expense_splits(member_id) where settled_at is null;

-- ---------------------------------------------------------------------------
-- SETTLEMENTS
-- Records when one member pays another. Updates expense_splits.settled_at.
-- ---------------------------------------------------------------------------
create table settlements (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  cycle_id         uuid references billing_cycles(id),
  from_member_id   uuid not null references members(id),
  to_member_id     uuid not null references members(id),
  amount           numeric(10,2) not null check (amount > 0),
  method           settlement_method not null default 'other',
  notes            text,
  settled_at       timestamptz not null default now(),
  check (from_member_id != to_member_id)
);

create index idx_settlements_household on settlements(household_id);
create index idx_settlements_from      on settlements(from_member_id);
create index idx_settlements_to        on settlements(to_member_id);

-- Add the FK from expense_splits now that settlements exists
alter table expense_splits
  add constraint fk_splits_settlement
  foreign key (settlement_id) references settlements(id) on delete set null;

-- ---------------------------------------------------------------------------
-- MOVE OUTS
-- Records a formal departure. Closes out the member's obligations.
-- ---------------------------------------------------------------------------
create table move_outs (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references households(id) on delete cascade,
  departing_member_id   uuid not null references members(id),
  move_out_date         date not null,
  prorated_days_present int not null,   -- days member was present in final cycle
  cycle_total_days      int not null,   -- total days in the final cycle (for proration math audit trail)
  settlement_amount     numeric(10,2),  -- final net: positive = household owes them, negative = they owe household
  settlement_id         uuid references settlements(id),
  pdf_url               text,           -- Storage URL for the settlement PDF summary
  completed_at          timestamptz,    -- null = in progress; non-null = finalized
  created_at            timestamptz not null default now()
);

comment on column move_outs.prorated_days_present is
  'Stored for audit trail. Proration: amount * (days_present / cycle_total_days). '
  'Days present = move_out_date - cycle_start_date (inclusive of move-out day).';

create index idx_moveouts_household on move_outs(household_id);
create index idx_moveouts_member    on move_outs(departing_member_id);

-- ---------------------------------------------------------------------------
-- SUBSCRIPTIONS
-- Managed by RevenueCat webhook → Supabase Edge Function.
-- One row per household. Updated on every RevenueCat event.
-- ---------------------------------------------------------------------------
create table subscriptions (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null unique references households(id) on delete cascade,
  status          subscription_status not null default 'expired',
  revenuecat_id   text,               -- RC customer ID (= household_id cast to string)
  product_id      text,               -- e.g. 'homesplit_pro_monthly'
  expires_at      timestamptz,
  updated_at      timestamptz not null default now()
);

create index idx_subscriptions_household on subscriptions(household_id);
create index idx_subscriptions_status    on subscriptions(status);

-- ---------------------------------------------------------------------------
-- RLS: Enable on all tables
-- ---------------------------------------------------------------------------
alter table households      enable row level security;
alter table members         enable row level security;
alter table billing_cycles  enable row level security;
alter table expenses        enable row level security;
alter table expense_splits  enable row level security;
alter table recurring_bills enable row level security;
alter table settlements     enable row level security;
alter table move_outs       enable row level security;
alter table subscriptions   enable row level security;

-- ---------------------------------------------------------------------------
-- RLS HELPER FUNCTION
-- Returns true if the calling auth.uid() is an active member of the given household.
-- Used in every policy — always filter with left_at IS NULL.
-- ---------------------------------------------------------------------------
create or replace function is_household_member(hid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from members
    where household_id = hid
      and user_id = auth.uid()
      and left_at is null
  );
$$;

-- Also a variant that includes departed members (for move-out flow reads)
create or replace function was_household_member(hid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from members
    where household_id = hid
      and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS POLICIES: HOUSEHOLDS
-- ---------------------------------------------------------------------------
-- Read: active members of the household
create policy "household_select" on households
  for select using (is_household_member(id));

-- Insert: any authenticated user can create a household (they become first member next)
create policy "household_insert" on households
  for insert with check (auth.uid() is not null);

-- Update: only active members can update household settings
create policy "household_update" on households
  for update using (is_household_member(id));

-- Delete: not allowed via client — use service role only
-- (no delete policy = delete is blocked for anon key)

-- ---------------------------------------------------------------------------
-- RLS POLICIES: MEMBERS
-- ---------------------------------------------------------------------------
-- Read: active members can see all members (including departed) in their household
create policy "members_select" on members
  for select using (was_household_member(household_id));

-- Insert: active member can add a new member slot to their household
create policy "members_insert" on members
  for insert with check (is_household_member(household_id));

-- Update: member can update their own profile; any active member can update others' display info
create policy "members_update" on members
  for update using (
    is_household_member(household_id)
    or user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- RLS POLICIES: BILLING CYCLES
-- ---------------------------------------------------------------------------
create policy "cycles_select" on billing_cycles
  for select using (is_household_member(household_id));

-- Cycles are created by Edge Functions (service role) — no client insert needed

-- ---------------------------------------------------------------------------
-- RLS POLICIES: EXPENSES
-- ---------------------------------------------------------------------------
create policy "expenses_select" on expenses
  for select using (is_household_member(household_id));

create policy "expenses_insert" on expenses
  for insert with check (is_household_member(household_id));

create policy "expenses_update" on expenses
  for update using (is_household_member(household_id));

create policy "expenses_delete" on expenses
  for delete using (
    is_household_member(household_id)
    and recurring_bill_id is null   -- cannot delete auto-posted recurring expenses via client
  );

-- ---------------------------------------------------------------------------
-- RLS POLICIES: EXPENSE SPLITS
-- ---------------------------------------------------------------------------
-- Splits are always read/written together with their expense
create policy "splits_select" on expense_splits
  for select using (
    exists (
      select 1 from expenses e
      where e.id = expense_splits.expense_id
        and is_household_member(e.household_id)
    )
  );

create policy "splits_insert" on expense_splits
  for insert with check (
    exists (
      select 1 from expenses e
      where e.id = expense_splits.expense_id
        and is_household_member(e.household_id)
    )
  );

create policy "splits_update" on expense_splits
  for update using (
    exists (
      select 1 from expenses e
      where e.id = expense_splits.expense_id
        and is_household_member(e.household_id)
    )
  );

-- ---------------------------------------------------------------------------
-- RLS POLICIES: RECURRING BILLS
-- ---------------------------------------------------------------------------
create policy "bills_select" on recurring_bills
  for select using (is_household_member(household_id));

create policy "bills_insert" on recurring_bills
  for insert with check (is_household_member(household_id));

create policy "bills_update" on recurring_bills
  for update using (is_household_member(household_id));

create policy "bills_delete" on recurring_bills
  for delete using (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- RLS POLICIES: SETTLEMENTS
-- ---------------------------------------------------------------------------
create policy "settlements_select" on settlements
  for select using (is_household_member(household_id));

create policy "settlements_insert" on settlements
  for insert with check (
    is_household_member(household_id)
    and from_member_id in (
      select id from members where user_id = auth.uid()
    )
  );

-- Settlements are immutable once created — no update/delete via client

-- ---------------------------------------------------------------------------
-- RLS POLICIES: MOVE OUTS
-- ---------------------------------------------------------------------------
create policy "moveouts_select" on move_outs
  for select using (was_household_member(household_id));

create policy "moveouts_insert" on move_outs
  for insert with check (is_household_member(household_id));

create policy "moveouts_update" on move_outs
  for update using (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- RLS POLICIES: SUBSCRIPTIONS
-- ---------------------------------------------------------------------------
-- Members can read their household subscription status (for paywall gating)
create policy "subscriptions_select" on subscriptions
  for select using (is_household_member(household_id));

-- Subscriptions are written by RevenueCat webhook (service role) — no client insert/update

-- ---------------------------------------------------------------------------
-- INVITE JOIN FUNCTION
-- Called when a user taps the invite deep link. Atomically:
-- 1. Finds the household by token
-- 2. Finds or creates the member row for this user
-- 3. Returns the household_id
-- ---------------------------------------------------------------------------
create or replace function join_household_by_token(token text)
returns uuid
language plpgsql
security definer
as $$
declare
  hid uuid;
  existing_member_id uuid;
begin
  -- Find household by invite token
  select id into hid from households where invite_token = token;
  if hid is null then
    raise exception 'Invalid or expired invite token';
  end if;

  -- Check if this user already has a member row (invited before signup)
  select id into existing_member_id
  from members
  where household_id = hid
    and user_id = auth.uid()
  limit 1;

  if existing_member_id is not null then
    -- Already a member (or was one) — update left_at if they're rejoining
    update members
    set left_at = null, joined_at = now()
    where id = existing_member_id and left_at is not null;
  else
    -- New member — create a minimal record; display_name updated on profile setup
    insert into members (household_id, user_id, display_name)
    values (hid, auth.uid(), split_part((select email from auth.users where id = auth.uid()), '@', 1));
  end if;

  return hid;
end;
$$;

-- ---------------------------------------------------------------------------
-- ROTATE INVITE TOKEN FUNCTION
-- Called by household admin to invalidate old invites.
-- ---------------------------------------------------------------------------
create or replace function rotate_invite_token(hid uuid)
returns text
language plpgsql
security definer
as $$
declare
  new_token text;
begin
  if not is_household_member(hid) then
    raise exception 'Not a member of this household';
  end if;

  new_token := encode(extensions.gen_random_bytes(16), 'hex');
  update households set invite_token = new_token where id = hid;
  return new_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- CLOSE BILLING CYCLE FUNCTION
-- Called by Edge Function cron on cycle_start_day.
-- Closes the current cycle and opens a new one.
-- ---------------------------------------------------------------------------
create or replace function close_and_open_cycle(hid uuid)
returns uuid  -- returns new cycle id
language plpgsql
security definer
as $$
declare
  h           households%rowtype;
  old_cycle   billing_cycles%rowtype;
  new_cycle   billing_cycles%rowtype;
  new_start   date;
  new_end     date;
begin
  select * into h from households where id = hid;

  -- Close the current open cycle (if any)
  update billing_cycles
  set closed_at = now()
  where household_id = hid and closed_at is null
  returning * into old_cycle;

  -- Calculate new cycle dates
  new_start := date_trunc('month', current_date) + (h.cycle_start_day - 1) * interval '1 day';
  if new_start <= current_date and old_cycle.id is not null then
    new_start := new_start + interval '1 month';
  end if;
  new_end := (new_start + interval '1 month' - interval '1 day')::date;

  -- Create new cycle
  insert into billing_cycles (household_id, start_date, end_date)
  values (hid, new_start, new_end)
  returning * into new_cycle;

  return new_cycle.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- CREATE HOUSEHOLD FUNCTION
-- Atomically bootstraps a new household:
--   1. Inserts the households row
--   2. Inserts the creator as the first member (linked to auth.uid())
--   3. Inserts the first billing_cycles row so expenses can be posted immediately
--   4. Inserts a subscriptions row in 'expired' status so paywall gating has a row to read
-- Must be called via supabase.rpc('create_household', {...}) — never insert directly.
-- ---------------------------------------------------------------------------
create or replace function create_household(
  p_name            text,
  p_display_name    text,
  p_address         text default null,
  p_timezone        text default 'America/New_York',
  p_cycle_start_day int  default 1
)
returns uuid
language plpgsql
security definer
as $$
declare
  new_household_id uuid;
  cycle_start      date;
  cycle_end        date;
  today            date := current_date;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to create a household';
  end if;

  if p_cycle_start_day < 1 or p_cycle_start_day > 28 then
    raise exception 'cycle_start_day must be between 1 and 28';
  end if;

  -- 1. Create household
  insert into households (name, address, timezone, cycle_start_day)
  values (p_name, p_address, p_timezone, p_cycle_start_day)
  returning id into new_household_id;

  -- 2. Create first member (the creator)
  insert into members (household_id, user_id, display_name)
  values (new_household_id, auth.uid(), p_display_name);

  -- 3. Bootstrap first billing cycle
  --    Start = most recent cycle_start_day on or before today (so "now" falls inside the cycle)
  cycle_start := date_trunc('month', today)::date + (p_cycle_start_day - 1);
  if cycle_start > today then
    cycle_start := (cycle_start - interval '1 month')::date;
  end if;
  cycle_end := (cycle_start + interval '1 month' - interval '1 day')::date;

  insert into billing_cycles (household_id, start_date, end_date)
  values (new_household_id, cycle_start, cycle_end);

  -- 4. Bootstrap subscription row (expired by default — upgraded via RevenueCat webhook)
  insert into subscriptions (household_id, status)
  values (new_household_id, 'expired');

  return new_household_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- COMPUTED VIEW: member_balances
-- Convenience view — use in React Query hooks that power the Dashboard.
-- Shows net balance per member for the current (open) cycle.
-- ---------------------------------------------------------------------------
create or replace view member_balances as
select
  m.id                                      as member_id,
  m.household_id,
  m.display_name,
  m.color,
  coalesce(paid.total_paid, 0)              as total_paid,
  coalesce(owed.total_owed, 0)              as total_owed,
  coalesce(paid.total_paid, 0)
    - coalesce(owed.total_owed, 0)          as net_balance   -- positive = household owes them
from members m
left join (
  select paid_by_member_id as member_id,
         sum(amount) as total_paid
  from expenses e
  join billing_cycles c on c.id = e.cycle_id
  where c.closed_at is null
  group by paid_by_member_id
) paid on paid.member_id = m.id
left join (
  select es.member_id,
         sum(es.amount_owed) as total_owed
  from expense_splits es
  join expenses e on e.id = es.expense_id
  join billing_cycles c on c.id = e.cycle_id
  where c.closed_at is null
    and es.settled_at is null
  group by es.member_id
) owed on owed.member_id = m.id
where m.left_at is null;

-- =============================================================================
-- END OF MIGRATION 001
-- Next: 002_seed_dev_data.sql (dev only — never run on prod)
-- =============================================================================
