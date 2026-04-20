import { cycleTotalDays, daysPresent, prorateAmount } from './proration';

const CYCLE_START = '2026-05-01';
const CYCLE_END = '2026-05-31';

describe('cycleTotalDays', () => {
  it('counts a full 31-day month inclusively', () => {
    expect(cycleTotalDays(CYCLE_START, CYCLE_END)).toBe(31);
  });

  it('counts a 28-day February inclusively', () => {
    expect(cycleTotalDays('2026-02-01', '2026-02-28')).toBe(28);
  });

  it('counts a leap-year February inclusively', () => {
    expect(cycleTotalDays('2028-02-01', '2028-02-29')).toBe(29);
  });

  it('returns 1 for a same-day cycle', () => {
    expect(cycleTotalDays('2026-05-15', '2026-05-15')).toBe(1);
  });

  it('falls back safely for malformed ISO (both parse to epoch)', () => {
    expect(cycleTotalDays('', '')).toBe(1);
  });
});

describe('daysPresent', () => {
  it('returns full cycle length when move-out is the last day', () => {
    expect(daysPresent(CYCLE_START, CYCLE_END, CYCLE_END)).toBe(31);
  });

  it('returns full cycle length when move-out is after the cycle end', () => {
    expect(daysPresent(CYCLE_START, CYCLE_END, '2026-06-15')).toBe(31);
  });

  it('returns 1 when move-out is the same day as cycle start', () => {
    expect(daysPresent(CYCLE_START, CYCLE_END, CYCLE_START)).toBe(1);
  });

  it('returns 0 when move-out is before cycle start', () => {
    expect(daysPresent(CYCLE_START, CYCLE_END, '2026-04-20')).toBe(0);
  });

  it('counts mid-cycle move-out inclusively', () => {
    expect(daysPresent(CYCLE_START, CYCLE_END, '2026-05-16')).toBe(16);
  });
});

describe('prorateAmount', () => {
  it('returns full amount when member is present the entire cycle', () => {
    expect(prorateAmount(900, CYCLE_START, CYCLE_END, CYCLE_END)).toBeCloseTo(900, 2);
  });

  it('returns roughly half when moving out near the midpoint', () => {
    expect(prorateAmount(900, CYCLE_START, CYCLE_END, '2026-05-16')).toBeCloseTo(
      (900 * 16) / 31,
      2,
    );
  });

  it('returns full amount if move-out is after the cycle end', () => {
    expect(prorateAmount(1200, CYCLE_START, CYCLE_END, '2027-01-01')).toBeCloseTo(1200, 2);
  });

  it('returns 0 when member moved out before the cycle started', () => {
    expect(prorateAmount(900, CYCLE_START, CYCLE_END, '2026-04-01')).toBe(0);
  });

  it('returns a single day share when moving out on cycle start day', () => {
    const expected = parseFloat((900 / 31).toFixed(2));
    expect(prorateAmount(900, CYCLE_START, CYCLE_END, CYCLE_START)).toBe(expected);
  });

  it('is zero for a $0 bill regardless of days', () => {
    expect(prorateAmount(0, CYCLE_START, CYCLE_END, '2026-05-16')).toBe(0);
  });

  it('result is rounded to two decimals', () => {
    const result = prorateAmount(100, CYCLE_START, CYCLE_END, '2026-05-10');
    expect(result).toBe(parseFloat(result.toFixed(2)));
  });

  it('never exceeds the full amount', () => {
    const result = prorateAmount(500, CYCLE_START, CYCLE_END, '2030-01-01');
    expect(result).toBeLessThanOrEqual(500);
  });

  it('scales linearly with days present', () => {
    const oneDay = prorateAmount(310, CYCLE_START, CYCLE_END, CYCLE_START);
    const tenDays = prorateAmount(310, CYCLE_START, CYCLE_END, '2026-05-10');
    expect(tenDays / oneDay).toBeCloseTo(10, 1);
  });

  it('handles leap-year February correctly', () => {
    const result = prorateAmount(290, '2028-02-01', '2028-02-29', '2028-02-15');
    expect(result).toBeCloseTo((290 * 15) / 29, 2);
  });

  it('returns 0 defensively when cycle end precedes cycle start', () => {
    expect(prorateAmount(900, '2026-05-31', '2026-05-01', '2026-05-16')).toBe(0);
  });

  it('tolerates malformed ISO strings via epoch fallback — returns finite 0 (not NaN)', () => {
    const result = prorateAmount(100, '', '', '');
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(0);
  });

  it('tolerates partial ISO strings without throwing or returning NaN', () => {
    const result = prorateAmount(100, '2026', '2026-05', '2026-05-15');
    expect(Number.isFinite(result)).toBe(true);
  });
});
