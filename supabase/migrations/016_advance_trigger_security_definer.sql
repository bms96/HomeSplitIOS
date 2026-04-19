-- 016_advance_trigger_security_definer.sql
-- advance_bill_if_fully_paid runs on the invoking user's permissions by
-- default. Its internal DELETE was being filtered by the bill_cycle_payments
-- RLS DELETE policy in subtle ways when invoked by the mobile client,
-- leaving stale paid rows after advancement. Promote the function to
-- SECURITY DEFINER so it bypasses RLS and behaves identically whether
-- invoked by the service role or an end-user session.
--
-- `set search_path = public, pg_temp` is the standard hardening for
-- SECURITY DEFINER functions — prevents search_path hijacking.

create or replace function advance_bill_if_fully_paid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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

  delete from bill_cycle_payments
    where bill_id = new.bill_id
      and cycle_id = new.cycle_id;

  return new;
end;
$$;
