-- Allow household members to delete settlements in their household.
-- Mirrors the existing settlements_select scope. Needed for reset/undo flows.

create policy settlements_delete on settlements
  for delete
  using (is_household_member(household_id));
