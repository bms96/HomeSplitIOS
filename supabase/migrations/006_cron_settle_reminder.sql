-- ---------------------------------------------------------------------------
-- 006 — Weekly settle-up reminder cron
-- Fires Sunday 09:00 UTC. Calls the `send-settle-reminder` Edge Function which
-- fan-outs Expo push notifications to every member of every household with
-- unsettled balances this cycle.
-- ---------------------------------------------------------------------------

-- Idempotent: drop an existing job of the same name before scheduling.
do $$
begin
  perform cron.unschedule('send-settle-reminder');
exception when others then
  null;
end $$;

select
  cron.schedule(
    'send-settle-reminder',
    '0 9 * * 0',
    $$
    select
      net.http_post(
        url      := 'https://lhnfhuydteeqsvtvuwxf.supabase.co/functions/v1/send-settle-reminder',
        headers  := jsonb_build_object(
          'content-type', 'application/json',
          'authorization', 'Bearer ' || (
            select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'
          )
        ),
        body     := '{}'::jsonb,
        timeout_milliseconds := 15000
      );
    $$
  );
