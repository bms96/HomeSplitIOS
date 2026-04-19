-- ---------------------------------------------------------------------------
-- 005 — Push tokens
-- Stores Expo push tokens per user-device. A single user may have multiple rows
-- (phone + tablet). On sign-out we delete the token; on duplicate token we
-- update `updated_at` so we can prune stale tokens later.
-- ---------------------------------------------------------------------------

create table if not exists push_tokens (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  token       text        not null,
  platform    text        not null check (platform in ('ios', 'android', 'web')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists push_tokens_user_idx on push_tokens (user_id);

-- A helper view: given a set of member IDs, expand to active push tokens.
create or replace view member_push_tokens as
select
  m.id           as member_id,
  m.household_id as household_id,
  pt.token       as token,
  pt.platform    as platform
from members m
join push_tokens pt on pt.user_id = m.user_id
where m.user_id is not null
  and m.left_at is null;

alter table push_tokens enable row level security;

-- A user can manage only their own tokens. Edge Functions using the service
-- role bypass RLS when reading tokens for a fan-out send.
create policy "push_tokens_select_self" on push_tokens
  for select using (user_id = auth.uid());

create policy "push_tokens_insert_self" on push_tokens
  for insert with check (user_id = auth.uid());

create policy "push_tokens_update_self" on push_tokens
  for update using (user_id = auth.uid());

create policy "push_tokens_delete_self" on push_tokens
  for delete using (user_id = auth.uid());
