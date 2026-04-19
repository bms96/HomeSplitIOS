-- 009_bill_split_mode.sql
-- Adds a split_mode to recurring_bills so rent (and similar bills) can be
-- posted as either:
--   - one_pays        : a single payer fronts the whole bill; others owe them
--                       their share (current behavior; default)
--   - each_pays_share : each roommate pays their own share directly to an
--                       external party (e.g. landlord). The cron posts one
--                       self-paid expense per included member so each person
--                       can individually mark their share paid.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'bill_split_mode') then
    create type bill_split_mode as enum ('one_pays', 'each_pays_share');
  end if;
end $$;

alter table recurring_bills
  add column if not exists split_mode bill_split_mode not null default 'one_pays';
