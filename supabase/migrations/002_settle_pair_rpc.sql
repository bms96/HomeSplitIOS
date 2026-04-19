-- =============================================================================
-- Homesplit — Migration 002: settle_pair RPC
-- File: supabase/migrations/002_settle_pair_rpc.sql
-- Atomically create a settlement row and mark the corresponding expense_splits
-- between two members (in the current open cycle) as settled.
-- =============================================================================

create or replace function settle_pair(
  p_household_id    uuid,
  p_from_member_id  uuid,
  p_to_member_id    uuid,
  p_amount          numeric,
  p_method          settlement_method default 'other',
  p_notes           text default null
) returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_cycle_id      uuid;
  v_settlement_id uuid;
  v_caller_member uuid;
begin
  if p_from_member_id = p_to_member_id then
    raise exception 'from and to members must differ';
  end if;
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- Caller must be a member of this household (enforces authorization; RLS
  -- already filters, but we check explicitly so we fail fast with a clear error).
  select id into v_caller_member
  from members
  where household_id = p_household_id
    and user_id = auth.uid()
    and left_at is null
  limit 1;
  if v_caller_member is null then
    raise exception 'not a member of this household';
  end if;

  -- Find the current open cycle for this household.
  select id into v_cycle_id
  from billing_cycles
  where household_id = p_household_id
    and closed_at is null
  order by start_date desc
  limit 1;
  if v_cycle_id is null then
    raise exception 'no open billing cycle';
  end if;

  -- Create the settlement record.
  insert into settlements (
    household_id, cycle_id, from_member_id, to_member_id, amount, method, notes
  ) values (
    p_household_id, v_cycle_id, p_from_member_id, p_to_member_id, p_amount, p_method, p_notes
  ) returning id into v_settlement_id;

  -- Mark all unsettled splits between these two members (either direction)
  -- within the current cycle as settled.
  update expense_splits es
  set settled_at    = now(),
      settlement_id = v_settlement_id
  from expenses e
  where es.expense_id = e.id
    and e.household_id = p_household_id
    and e.cycle_id = v_cycle_id
    and es.settled_at is null
    and (
      (es.member_id = p_from_member_id and e.paid_by_member_id = p_to_member_id)
      or
      (es.member_id = p_to_member_id   and e.paid_by_member_id = p_from_member_id)
    );

  return v_settlement_id;
end;
$$;

comment on function settle_pair is
  'Settles all outstanding splits between two members in the current cycle. Creates a settlement row and marks the splits as paid.';
