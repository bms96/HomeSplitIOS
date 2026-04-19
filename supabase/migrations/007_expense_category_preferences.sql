-- =============================================================================
-- Homesplit — Expense Category Preferences
-- File: supabase/migrations/007_expense_category_preferences.sql
-- Lets each household hide or rename the fixed `expense_category` enum values
-- without introducing user-defined categories (which would require FK churn on
-- every expense). MVP compromise: enum stays authoritative, this table is a
-- per-household display layer.
-- =============================================================================

create table expense_category_preferences (
  household_id uuid not null references households(id) on delete cascade,
  category     expense_category not null,
  hidden       boolean not null default false,
  custom_label text,
  updated_at   timestamptz not null default now(),
  primary key (household_id, category)
);

comment on column expense_category_preferences.custom_label is
  'Override for the default category name shown in UI. null means use the enum value.';
comment on column expense_category_preferences.hidden is
  'When true, the category is omitted from the add/edit expense picker. Existing expenses keep their category.';

alter table expense_category_preferences enable row level security;

create policy "category_prefs_select" on expense_category_preferences
  for select using (is_household_member(household_id));

create policy "category_prefs_insert" on expense_category_preferences
  for insert with check (is_household_member(household_id));

create policy "category_prefs_update" on expense_category_preferences
  for update using (is_household_member(household_id));

create policy "category_prefs_delete" on expense_category_preferences
  for delete using (is_household_member(household_id));
