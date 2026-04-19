/**
 * Days a member was present in a cycle, inclusive of both endpoints.
 * Returns 0 if move-out is before cycle start.
 */
export function daysPresent(
  cycleStartIso: string,
  cycleEndIso: string,
  moveOutIso: string,
): number {
  const start = parseIso(cycleStartIso);
  const end = parseIso(cycleEndIso);
  const move = parseIso(moveOutIso);
  if (move < start) return 0;
  const last = move > end ? end : move;
  const ms = last.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

export function cycleTotalDays(cycleStartIso: string, cycleEndIso: string): number {
  const start = parseIso(cycleStartIso);
  const end = parseIso(cycleEndIso);
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Prorate a full amount by days-present fraction. Rounded to cents.
 */
export function prorateAmount(
  fullAmount: number,
  cycleStartIso: string,
  cycleEndIso: string,
  moveOutIso: string,
): number {
  if (!isValidIso(cycleStartIso) || !isValidIso(cycleEndIso) || !isValidIso(moveOutIso)) {
    return 0;
  }
  const present = daysPresent(cycleStartIso, cycleEndIso, moveOutIso);
  const total = cycleTotalDays(cycleStartIso, cycleEndIso);
  if (total <= 0) return 0;
  return parseFloat(((fullAmount * present) / total).toFixed(2));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIso(iso: string): boolean {
  return ISO_DATE.test(iso);
}

function parseIso(iso: string): Date {
  if (!ISO_DATE.test(iso)) return new Date(0);
  const parts = iso.split('-').map(Number);
  const [y, m, d] = parts as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}
