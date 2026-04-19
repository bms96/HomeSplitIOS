-- =============================================================================
-- Homesplit — Migration 003: schedule process-recurring-bills cron
-- File: supabase/migrations/003_cron_recurring_bills.sql
--
-- Creates a daily pg_cron job that invokes the process-recurring-bills Edge
-- Function via pg_net.http_post. The CRON_SECRET is read from Supabase Vault
-- (stored there out-of-band via `vault.create_secret` — never commit the
-- literal value).
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop any prior schedule so re-running is safe.
do $$
declare
  jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'process-recurring-bills';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
end $$;

-- Runs every day at 03:15 UTC.
select cron.schedule(
  'process-recurring-bills',
  '15 3 * * *',
  $cron$
    select net.http_post(
      url := 'https://lhnfhuydteeqsvtvuwxf.supabase.co/functions/v1/process-recurring-bills',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'cron_secret'
          limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$
);
