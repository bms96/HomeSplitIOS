import type { Database } from '@/types/database';

export type BillFrequency = Database['public']['Enums']['bill_cycle_frequency'];

/**
 * Advance an ISO (YYYY-MM-DD) due date by one unit of the bill's frequency.
 *
 * Monthly advancement uses end-of-month clamping to match PostgreSQL's
 * `date + interval '1 month'` semantics: Jan 31 + 1 month = Feb 28 (or 29
 * in a leap year), NOT March 3. The SQL trigger in migration 014 uses
 * the same clamping, so these two implementations must agree.
 *
 * NOTE: the process-recurring-bills edge function currently uses plain
 * `Date.setUTCMonth(+1)` which overflows into the next month (Jan 31 → Mar 3).
 * That's a pre-existing inconsistency; if you unify, bring the edge function
 * into this function's rules, not the other way around.
 */
export function advanceDueDate(iso: string, frequency: BillFrequency): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) {
    throw new Error(`advanceDueDate: invalid ISO date "${iso}"`);
  }
  const date = new Date(Date.UTC(y, m - 1, d));

  if (frequency === 'weekly') {
    date.setUTCDate(date.getUTCDate() + 7);
  } else if (frequency === 'biweekly') {
    date.setUTCDate(date.getUTCDate() + 14);
  } else {
    // All monthly variants: compute target month first.
    const nextMonthIndex = date.getUTCMonth() + 1;
    const targetYear = date.getUTCFullYear() + Math.floor(nextMonthIndex / 12);
    const targetMonth = nextMonthIndex % 12;
    const lastDayOfTargetMonth = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0),
    ).getUTCDate();

    let targetDay: number;
    if (frequency === 'monthly_first') {
      // Pinned: always the 1st of the next month.
      targetDay = 1;
    } else if (frequency === 'monthly_last') {
      // Pinned: always the last day of the next month (28/29/30/31).
      targetDay = lastDayOfTargetMonth;
    } else {
      // Monthly: preserve day-of-month, clamp to end of target month.
      targetDay = Math.min(date.getUTCDate(), lastDayOfTargetMonth);
    }
    date.setUTCFullYear(targetYear, targetMonth, targetDay);
  }

  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Predicate mirroring the SQL trigger's advancement guard. A bill rolls
 * forward only when all four conditions hold:
 *   - the bill is active,
 *   - its due date is today or in the past (daysUntilDue <= 0),
 *   - there is at least one included member,
 *   - every included member has a recorded payment for the current cycle.
 */
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Human-readable cadence label for a recurring bill. Weekly and biweekly
 * derive the day-of-week from the next-due date so the label remains in
 * sync with the advancement schedule (no separate day-of-week column).
 */
export function formatFrequency(frequency: BillFrequency, nextDueDateIso: string): string {
  if (frequency === 'monthly') return 'Monthly';
  if (frequency === 'monthly_first') return '1st of every month';
  if (frequency === 'monthly_last') return 'Last day of every month';

  const [y, m, d] = nextDueDateIso.split('-').map(Number);
  if (!y || !m || !d) {
    return frequency === 'weekly' ? 'Weekly' : 'Biweekly';
  }
  const dayIdx = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const dayName = DAY_NAMES[dayIdx];
  return frequency === 'weekly' ? `Every ${dayName}` : `Every other ${dayName}`;
}

export function shouldAdvanceBill(params: {
  active: boolean;
  daysUntilDue: number;
  paidCount: number;
  includedCount: number;
}): boolean {
  if (!params.active) return false;
  if (params.daysUntilDue > 0) return false;
  if (params.includedCount <= 0) return false;
  return params.paidCount >= params.includedCount;
}
