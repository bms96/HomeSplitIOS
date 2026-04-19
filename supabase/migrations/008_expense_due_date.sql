-- =============================================================================
-- Homesplit — Migration 008: optional due_date on expenses
-- File: supabase/migrations/008_expense_due_date.sql
-- Adds an optional due_date to expenses so one-time bills/expenses can surface
-- on the dashboard's upcoming section alongside recurring bills.
-- =============================================================================

alter table expenses add column if not exists due_date date;

create index if not exists idx_expenses_due_date
  on expenses(household_id, cycle_id, due_date)
  where due_date is not null;

comment on column expenses.due_date is
  'Optional date this expense is due. Used to surface unpaid expenses on the dashboard.';
