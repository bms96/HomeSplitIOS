-- 015_clear_payments_on_advance.sql
-- When advance_bill_if_fully_paid rolls a bill forward, also clear the
-- per-member bill_cycle_payments rows for the closed cycle so the next
-- cycle starts at "0 of N paid".
--
-- Why: bill_cycle_payments.cycle_id references the HOUSEHOLD billing cycle,
-- not a per-bill cycle. A monthly rent bill can advance mid-household-cycle
-- (e.g., rent Apr 13 → May 13 while the household cycle still covers
-- Apr 1 – Apr 30), leaving stale paid rows that make the bill look
-- "3 of 3 paid" for the new cycle. Deleting them keeps the slate clean.
--
-- History: the advancement itself is the durable record that everyone paid
-- for the closed cycle — there is no UI that reads per-member closed-cycle
-- payment rows, so no data the user can see is lost.
--
-- Backfill: rent has already been advanced by migration 014's trigger on
-- this environment, but its three paid rows remain. A one-shot cleanup
-- deletes any bcp rows whose bill's current next_due_date is strictly
-- greater than the row's implied cycle — conservative: delete bcp rows
-- that belong to a bill + cycle where the bill has already moved on.
-- We can't reliably detect that without a due-date stamp on the payment,
-- so we instead target the known stale state: rows for a bill whose
-- next_due_date is after the household cycle's end_date.

create or replace function advance_bill_if_fully_paid()
returns trigger
language plpgsql
as $$
declare
  v_bill              recurring_bills%rowtype;
  v_excluded_ids      text[];
  v_included_count    integer;
  v_paid_count        integer;
  v_today             date := current_date;
  v_next_due          date;
begin
  select * into v_bill from recurring_bills where id = new.bill_id;
  if not found or not v_bill.active then
    return new;
  end if;

  if v_bill.next_due_date > v_today then
    return new;
  end if;

  v_excluded_ids := coalesce(
    array(
      select jsonb_array_elements_text(
        coalesce(v_bill.custom_splits -> 'excluded_member_ids', '[]'::jsonb)
      )
    ),
    array[]::text[]
  );

  select count(*) into v_included_count
    from members
    where household_id = v_bill.household_id
      and left_at is null
      and id::text <> all(v_excluded_ids);

  if v_included_count <= 0 then
    return new;
  end if;

  select count(*) into v_paid_count
    from bill_cycle_payments
    where bill_id = new.bill_id
      and cycle_id = new.cycle_id;

  if v_paid_count < v_included_count then
    return new;
  end if;

  v_next_due := (case v_bill.frequency
    when 'weekly'   then v_bill.next_due_date + interval '7 days'
    when 'biweekly' then v_bill.next_due_date + interval '14 days'
    when 'monthly'  then v_bill.next_due_date + interval '1 month'
  end)::date;

  update recurring_bills
    set next_due_date = v_next_due
    where id = new.bill_id;

  -- Clear the closed cycle's paid rows so the new cycle starts fresh.
  delete from bill_cycle_payments
    where bill_id = new.bill_id
      and cycle_id = new.cycle_id;

  return new;
end;
$$;

-- One-shot backfill: clear stale payment rows left over from migration 014
-- for bills that already advanced. A payment row is stale iff its bill's
-- current next_due_date has moved past the household cycle's end_date
-- (i.e., the bill is ahead of the cycle the payment claims to cover).
delete from bill_cycle_payments bcp
using recurring_bills rb, billing_cycles bc
where bcp.bill_id = rb.id
  and bcp.cycle_id = bc.id
  and rb.next_due_date > bc.end_date;
