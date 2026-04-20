/**
 * Recurring-bill cycle status helpers.
 *
 * A bill's "overdue" state is not purely date-driven — if every included
 * member has paid, the bill is done, even if its next_due_date hasn't been
 * advanced yet (e.g. the daily cron hasn't run). These helpers centralize
 * that rule so the home screen, bills list, and bill detail all agree.
 */

/**
 * True when every included member has recorded a payment for this cycle.
 * Returns false for zero-included bills to avoid the vacuous-truth trap
 * (a bill nobody is on should never read as "fully paid").
 */
export function isBillFullyPaid(params: {
  paidCount: number;
  includedCount: number;
}): boolean {
  if (params.includedCount <= 0) return false;
  return params.paidCount >= params.includedCount;
}

/**
 * True when the bill is past its due date AND at least one included member
 * still hasn't paid. A fully-paid past-due bill is not "overdue" — it's done.
 */
export function isBillEffectivelyOverdue(params: {
  daysUntilDue: number;
  paidCount: number;
  includedCount: number;
}): boolean {
  if (params.daysUntilDue >= 0) return false;
  if (params.includedCount <= 0) return false;
  return params.paidCount < params.includedCount;
}
