The following updates need to be made keeping in mind the best user experience without breaking any functionality:

## Home

## Expenses

### Add Expense screen

## Bills

- Unify monthly advancement: `supabase/functions/process-recurring-bills` still uses `Date.setUTCMonth(+1)` which overflows (Jan 31 → Mar 3), while `utils/billFrequency.ts` and migration `014` use end-of-month clamping (Jan 31 → Feb 28). Bring the edge function into alignment with the clamping rules.
- Add percentage split method (`custom_pct`) — slider UI per member with live dollar amount. Calculator and tests already exist in `utils/splits.ts`. Deferred until UX is refined.

## Household