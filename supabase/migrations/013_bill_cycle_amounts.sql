-- 013_bill_cycle_amounts.sql
-- Per-cycle amount overrides for recurring bills.
--
-- Before: recurring_bills.amount was a single template value. Variable bills
-- (amount IS NULL) had no place to record "this cycle the electric bill was
-- $47" other than editing the template, which then incorrectly implied the
-- same amount for every future cycle. The client had no way to surface
-- "amount needed" on a per-cycle basis.
--
-- After: bill_cycle_amounts stores a per-(bill, cycle) amount. For fixed
-- bills, recurring_bills.amount remains the default; an override row may
-- still be inserted for a one-off deviation. For variable bills, a row in
-- this table is required before any member can mark themselves paid for
-- that cycle — enforced by a trigger on bill_cycle_payments below.

create table bill_cycle_amounts (
  id         uuid primary key default gen_random_uuid(),
  bill_id    uuid not null references recurring_bills(id) on delete cascade,
  cycle_id   uuid not null references billing_cycles(id) on delete cascade,
  amount     numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bill_id, cycle_id)
);

create index idx_bca_bill_cycle on bill_cycle_amounts(bill_id, cycle_id);

alter table bill_cycle_amounts enable row level security;

create policy bca_select on bill_cycle_amounts
  for select
  using (
    exists (
      select 1 from recurring_bills b
      where b.id = bill_cycle_amounts.bill_id
        and is_household_member(b.household_id)
    )
  );

create policy bca_insert on bill_cycle_amounts
  for insert
  with check (
    exists (
      select 1 from recurring_bills b
      where b.id = bill_cycle_amounts.bill_id
        and is_household_member(b.household_id)
    )
  );

create policy bca_update on bill_cycle_amounts
  for update
  using (
    exists (
      select 1 from recurring_bills b
      where b.id = bill_cycle_amounts.bill_id
        and is_household_member(b.household_id)
    )
  )
  with check (
    exists (
      select 1 from recurring_bills b
      where b.id = bill_cycle_amounts.bill_id
        and is_household_member(b.household_id)
    )
  );

create policy bca_delete on bill_cycle_amounts
  for delete
  using (
    exists (
      select 1 from recurring_bills b
      where b.id = bill_cycle_amounts.bill_id
        and is_household_member(b.household_id)
    )
  );

-- Keep updated_at current on edits.
create or replace function touch_bill_cycle_amounts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bca_touch_updated_at
  before update on bill_cycle_amounts
  for each row execute function touch_bill_cycle_amounts_updated_at();

-- Server-side guard: block mark-paid when there is no effective amount.
-- Effective amount for (bill, cycle) = override if present, else template.
create or replace function enforce_bill_payment_amount()
returns trigger
language plpgsql
as $$
declare
  v_template_amount numeric(12, 2);
  v_has_override    boolean;
begin
  select amount into v_template_amount
    from recurring_bills
    where id = new.bill_id;

  if v_template_amount is not null then
    return new;
  end if;

  select exists (
    select 1 from bill_cycle_amounts
    where bill_id = new.bill_id
      and cycle_id = new.cycle_id
  ) into v_has_override;

  if not v_has_override then
    raise exception
      'Cannot mark bill paid: variable bill has no amount set for this cycle'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger bcp_enforce_amount
  before insert on bill_cycle_payments
  for each row execute function enforce_bill_payment_amount();
