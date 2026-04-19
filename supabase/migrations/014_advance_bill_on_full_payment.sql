-- 014_advance_bill_on_full_payment.sql
-- Roll a recurring bill forward the moment every included member has marked
-- themselves paid for the current cycle.
--
-- Before: `recurring_bills.next_due_date` was advanced only by the daily cron
-- (see 003_cron_recurring_bills.sql + process-recurring-bills edge function).
-- A fully-paid past-due bill would keep reading as "Overdue" in the UI for
-- up to 24h until the cron fired.
--
-- After: an AFTER INSERT trigger on bill_cycle_payments checks the full-paid
-- predicate and advances next_due_date immediately. The daily cron remains
-- as a backstop for bills that aren't fully paid on time.
--
-- Design notes:
--   * One-way ratchet — deleting a payment does NOT roll the bill back. If
--     members un-mark paid, the cron will catch the bill on its next pass.
--   * Runs only when next_due_date <= current_date. Early-paying roommates
--     (e.g., paying 3 days before rent is due) do NOT cause advancement;
--     the bill stays on the current cycle's due date until that date passes.
--   * Monthly advancement uses `date + interval '1 month'` which clamps to
--     end-of-month (Jan 31 → Feb 28 in a non-leap year). The TypeScript
--     mirror lives in utils/billFrequency.ts::advanceDueDate and is covered
--     by utils/billFrequency.test.ts. Keep them in sync.
--   * `custom_splits.excluded_member_ids` is a jsonb array of member UUIDs.
--     Empty / null / missing is treated as "nobody excluded".

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

  -- Early-paying roommates don't trigger advancement. Only past-due or
  -- due-today bills advance — matches shouldAdvanceBill in the client util.
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

  -- Everyone has paid, bill is at or past its due date: advance.
  -- The CASE arms use date + interval which clamps monthly to end-of-month.
  v_next_due := (case v_bill.frequency
    when 'weekly'   then v_bill.next_due_date + interval '7 days'
    when 'biweekly' then v_bill.next_due_date + interval '14 days'
    when 'monthly'  then v_bill.next_due_date + interval '1 month'
  end)::date;

  update recurring_bills
    set next_due_date = v_next_due
    where id = new.bill_id;

  return new;
end;
$$;

create trigger bcp_advance_on_full_payment
  after insert on bill_cycle_payments
  for each row execute function advance_bill_if_fully_paid();
