-- 010_bill_default_payer.sql
-- For recurring bills in `one_pays` split mode, remember which member is
-- expected to front the bill each cycle instead of falling back to the
-- earliest-joined active member. Nullable so legacy rows and
-- `each_pays_share` bills don't need a payer. ON DELETE SET NULL so a
-- move-out doesn't break the bill — the cron falls back to activeMembers[0].

alter table recurring_bills
  add column if not exists default_payer_member_id uuid
    references members(id) on delete set null;
