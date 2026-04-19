-- 012_bill_cycle_payments.sql
-- Full separation of bills and expenses.
--
-- Before: the cron posted synthetic `expenses` rows (one per cycle for
-- one_pays bills, or one per member for each_pays_share). Members marked
-- their share paid by settling the auto-generated expense split. This
-- polluted the Expenses tab with rows no one had manually entered and
-- produced confusing "You paid" labels for members who hadn't paid yet.
--
-- After: recurring bills live entirely in the Bills tab. Per-cycle payment
-- tracking sits on a new `bill_cycle_payments` table (one row per member per
-- cycle per bill, created when that member marks themselves paid). The cron
-- stops posting expenses and only advances `next_due_date`.
--
-- `split_mode` / `default_payer_member_id` on `recurring_bills` become
-- meaningless once nothing posts expenses, so both are dropped along with
-- the `bill_split_mode` enum. The Expenses tab goes back to being
-- one-time-only.

create table bill_cycle_payments (
  id          uuid primary key default gen_random_uuid(),
  bill_id     uuid not null references recurring_bills(id) on delete cascade,
  cycle_id    uuid not null references billing_cycles(id) on delete cascade,
  member_id   uuid not null references members(id) on delete cascade,
  settled_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (bill_id, cycle_id, member_id)
);

create index idx_bcp_bill_cycle on bill_cycle_payments(bill_id, cycle_id);
create index idx_bcp_member     on bill_cycle_payments(member_id);

alter table bill_cycle_payments enable row level security;

create policy bcp_select on bill_cycle_payments
  for select
  using (
    exists (
      select 1 from recurring_bills b
      where b.id = bill_cycle_payments.bill_id
        and is_household_member(b.household_id)
    )
  );

create policy bcp_insert on bill_cycle_payments
  for insert
  with check (
    exists (
      select 1 from recurring_bills b
      where b.id = bill_cycle_payments.bill_id
        and is_household_member(b.household_id)
    )
  );

create policy bcp_delete on bill_cycle_payments
  for delete
  using (
    exists (
      select 1 from recurring_bills b
      where b.id = bill_cycle_payments.bill_id
        and is_household_member(b.household_id)
    )
  );

-- Drop the per-bill split-mode / payer columns. Nothing posts expenses from
-- bills anymore, so these no longer have behavior attached.
alter table recurring_bills drop column if exists default_payer_member_id;
alter table recurring_bills drop column if exists split_mode;

drop type if exists bill_split_mode;

-- Relax the expenses_delete guard. Auto-posted expenses no longer exist
-- going forward, and the dev reset flow needs to be able to clear any
-- stragglers created before the refactor.
drop policy if exists "expenses_delete" on expenses;
drop policy if exists expenses_delete on expenses;

create policy expenses_delete on expenses
  for delete
  using (is_household_member(household_id));
