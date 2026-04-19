-- =============================================================================
-- Homesplit — Migration 004: complete_move_out RPC
-- File: supabase/migrations/004_move_out_rpc.sql
--
-- Atomically finalizes a roommate's departure:
--   1. For every expense in the current open cycle, adjust the departing
--      member's split:
--        • auto-posted recurring expense → prorate by days-present/cycle-days
--        • one-time expense dated AFTER move-out → zero their split
--        • one-time expense dated ≤ move-out     → unchanged
--      Redistribute the freed amount equally across the remaining active
--      members.
--   2. Set members.left_at.
--   3. Insert a move_outs row with completed_at = now().
--
-- Does NOT close outstanding balances — the caller is expected to settle via
-- the existing settle flow first (or separately). The move-out row's
-- settlement_amount is populated with the departing member's net for audit.
-- =============================================================================

create or replace function complete_move_out(
  p_household_id    uuid,
  p_member_id       uuid,
  p_move_out_date   date
) returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_caller_member   uuid;
  v_cycle           billing_cycles%rowtype;
  v_total_days      int;
  v_days_present    int;
  v_stayers         uuid[];
  v_stayer_count    int;
  v_expense         record;
  v_old_share       numeric(10,2);
  v_new_share       numeric(10,2);
  v_freed           numeric(10,2);
  v_extra_per       numeric(10,2);
  v_remainder       numeric(10,2);
  v_stayer          uuid;
  v_move_out_id     uuid;
  v_settlement_amt  numeric(10,2);
begin
  -- Authorization: caller must be an active member of this household.
  select id into v_caller_member
  from members
  where household_id = p_household_id
    and user_id = auth.uid()
    and left_at is null
  limit 1;
  if v_caller_member is null then
    raise exception 'not a member of this household';
  end if;

  -- Verify target member exists and hasn't already left.
  if not exists (
    select 1 from members
    where id = p_member_id
      and household_id = p_household_id
      and left_at is null
  ) then
    raise exception 'member not found or already left';
  end if;

  -- Current open cycle.
  select * into v_cycle
  from billing_cycles
  where household_id = p_household_id
    and closed_at is null
  order by start_date desc
  limit 1;
  if v_cycle.id is null then
    raise exception 'no open billing cycle';
  end if;

  if p_move_out_date < v_cycle.start_date then
    raise exception 'move-out date is before cycle start';
  end if;

  v_total_days   := (v_cycle.end_date - v_cycle.start_date) + 1;
  v_days_present := greatest(
    0,
    least((p_move_out_date - v_cycle.start_date) + 1, v_total_days)
  );

  -- Active members who are staying (exclude the departing one).
  select array_agg(id order by joined_at)
    into v_stayers
  from members
  where household_id = p_household_id
    and left_at is null
    and id <> p_member_id;
  v_stayer_count := coalesce(array_length(v_stayers, 1), 0);

  -- Adjust each expense's splits for the current cycle.
  for v_expense in
    select e.id, e.amount, e.date, e.recurring_bill_id
    from expenses e
    where e.household_id = p_household_id
      and e.cycle_id = v_cycle.id
  loop
    select amount_owed into v_old_share
    from expense_splits
    where expense_id = v_expense.id and member_id = p_member_id;
    if not found or v_old_share is null then
      continue;
    end if;

    if v_expense.recurring_bill_id is not null then
      -- Auto-posted recurring: prorate by days present.
      if v_total_days = 0 then
        v_new_share := 0;
      else
        v_new_share := round(v_old_share * v_days_present / v_total_days, 2);
      end if;
    elsif v_expense.date > p_move_out_date then
      -- One-time after move-out: they shouldn't owe anything.
      v_new_share := 0;
    else
      -- One-time before or on move-out: unchanged.
      v_new_share := v_old_share;
    end if;

    if v_new_share <> v_old_share then
      update expense_splits
        set amount_owed = v_new_share
        where expense_id = v_expense.id and member_id = p_member_id;

      v_freed := round(v_old_share - v_new_share, 2);
      if v_freed > 0 and v_stayer_count > 0 then
        v_extra_per := floor((v_freed * 100) / v_stayer_count) / 100.0;
        v_remainder := round(v_freed - (v_extra_per * v_stayer_count), 2);
        foreach v_stayer in array v_stayers loop
          update expense_splits
            set amount_owed = round(amount_owed + v_extra_per, 2)
            where expense_id = v_expense.id and member_id = v_stayer;
        end loop;
        if v_remainder <> 0 then
          update expense_splits
            set amount_owed = round(amount_owed + v_remainder, 2)
            where expense_id = v_expense.id and member_id = v_stayers[1];
        end if;
      end if;
    end if;
  end loop;

  -- Compute departing member's net (positive = household owes them).
  select
    coalesce(sum(case when e.paid_by_member_id = p_member_id then e.amount else 0 end), 0)
    - coalesce(sum(case when es.member_id = p_member_id and es.settled_at is null
                          then es.amount_owed else 0 end), 0)
  into v_settlement_amt
  from expenses e
  left join expense_splits es on es.expense_id = e.id
  where e.household_id = p_household_id
    and e.cycle_id = v_cycle.id;

  -- Mark member as departed.
  update members
    set left_at = (p_move_out_date::timestamptz + interval '23 hours 59 minutes')
    where id = p_member_id;

  -- Record the move-out.
  insert into move_outs (
    household_id, departing_member_id, move_out_date,
    prorated_days_present, cycle_total_days,
    settlement_amount, completed_at
  ) values (
    p_household_id, p_member_id, p_move_out_date,
    v_days_present, v_total_days,
    v_settlement_amt, now()
  )
  returning id into v_move_out_id;

  return v_move_out_id;
end;
$$;

comment on function complete_move_out is
  'Finalizes a roommate departure: prorates recurring splits, zeros post-date one-time splits, redistributes freed amounts, sets members.left_at, records a move_outs row.';
