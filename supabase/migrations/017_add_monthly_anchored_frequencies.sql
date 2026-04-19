-- 017_add_monthly_anchored_frequencies.sql
-- Add two anchored monthly variants:
--   * monthly_first — bill always falls on the 1st of the next month
--   * monthly_last  — bill always falls on the last day of the next month
--                     (28/29/30/31 depending on month/leap year)
--
-- The plain `monthly` variant continues to preserve the original day and
-- clamp forward (Jan 31 → Feb 28), which is the right semantics for a
-- free-form monthly bill. The two new variants are for bills like rent
-- that are pinned to the 1st or the last-day-of-month.

alter type bill_cycle_frequency add value if not exists 'monthly_first';
alter type bill_cycle_frequency add value if not exists 'monthly_last';
