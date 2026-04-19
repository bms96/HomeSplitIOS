import { advanceDueDate, formatFrequency, shouldAdvanceBill } from './billFrequency';

describe('advanceDueDate — weekly', () => {
  it('adds 7 days in the middle of a month', () => {
    expect(advanceDueDate('2026-05-10', 'weekly')).toBe('2026-05-17');
  });

  it('rolls across month boundary', () => {
    expect(advanceDueDate('2026-05-28', 'weekly')).toBe('2026-06-04');
  });

  it('rolls across year boundary', () => {
    expect(advanceDueDate('2026-12-28', 'weekly')).toBe('2027-01-04');
  });
});

describe('advanceDueDate — biweekly', () => {
  it('adds 14 days in the middle of a month', () => {
    expect(advanceDueDate('2026-05-01', 'biweekly')).toBe('2026-05-15');
  });

  it('rolls across month boundary', () => {
    expect(advanceDueDate('2026-05-20', 'biweekly')).toBe('2026-06-03');
  });

  it('handles a leap-year February transition', () => {
    expect(advanceDueDate('2028-02-20', 'biweekly')).toBe('2028-03-05');
  });
});

describe('advanceDueDate — monthly (end-of-month clamping)', () => {
  it('adds one calendar month for a mid-month date', () => {
    expect(advanceDueDate('2026-05-15', 'monthly')).toBe('2026-06-15');
  });

  it('clamps Jan 31 to Feb 28 in a non-leap year (matches PG interval)', () => {
    expect(advanceDueDate('2026-01-31', 'monthly')).toBe('2026-02-28');
  });

  it('clamps Jan 31 to Feb 29 in a leap year', () => {
    expect(advanceDueDate('2028-01-31', 'monthly')).toBe('2028-02-29');
  });

  it('clamps Mar 31 to Apr 30', () => {
    expect(advanceDueDate('2026-03-31', 'monthly')).toBe('2026-04-30');
  });

  it('does NOT clamp when target month has enough days', () => {
    expect(advanceDueDate('2026-04-30', 'monthly')).toBe('2026-05-30');
  });

  it('rolls across year boundary from December', () => {
    expect(advanceDueDate('2026-12-15', 'monthly')).toBe('2027-01-15');
  });

  it('clamps Dec 31 → Jan 31 preserves the 31st (Jan has 31 days)', () => {
    expect(advanceDueDate('2026-12-31', 'monthly')).toBe('2027-01-31');
  });

  it('is idempotent in lineage — Jan 31 → Feb 28 → Mar 28 (drift is expected after a clamp)', () => {
    const feb = advanceDueDate('2026-01-31', 'monthly');
    const mar = advanceDueDate(feb, 'monthly');
    expect(feb).toBe('2026-02-28');
    expect(mar).toBe('2026-03-28');
  });
});

describe('advanceDueDate — monthly_first (pinned to day 1)', () => {
  it('advances day-1 input to day-1 of next month', () => {
    expect(advanceDueDate('2026-04-01', 'monthly_first')).toBe('2026-05-01');
  });

  it('normalizes a mid-month input to day 1 of next month', () => {
    expect(advanceDueDate('2026-04-15', 'monthly_first')).toBe('2026-05-01');
  });

  it('normalizes a last-of-month input to day 1 of next month', () => {
    expect(advanceDueDate('2026-01-31', 'monthly_first')).toBe('2026-02-01');
  });

  it('rolls across year boundary from December', () => {
    expect(advanceDueDate('2026-12-01', 'monthly_first')).toBe('2027-01-01');
  });
});

describe('advanceDueDate — monthly_last (pinned to end of month)', () => {
  it('advances Apr 30 → May 31', () => {
    expect(advanceDueDate('2026-04-30', 'monthly_last')).toBe('2026-05-31');
  });

  it('advances May 31 → Jun 30 (clamps short month)', () => {
    expect(advanceDueDate('2026-05-31', 'monthly_last')).toBe('2026-06-30');
  });

  it('advances Jan 31 → Feb 28 in a non-leap year', () => {
    expect(advanceDueDate('2026-01-31', 'monthly_last')).toBe('2026-02-28');
  });

  it('advances Jan 31 → Feb 29 in a leap year', () => {
    expect(advanceDueDate('2028-01-31', 'monthly_last')).toBe('2028-02-29');
  });

  it('advances Feb 28 → Mar 31 (lands on end-of-March regardless of short input)', () => {
    expect(advanceDueDate('2026-02-28', 'monthly_last')).toBe('2026-03-31');
  });

  it('normalizes a mid-month input to end of next month', () => {
    expect(advanceDueDate('2026-04-15', 'monthly_last')).toBe('2026-05-31');
  });

  it('rolls across year boundary from December', () => {
    expect(advanceDueDate('2026-12-31', 'monthly_last')).toBe('2027-01-31');
  });
});

describe('advanceDueDate — error handling', () => {
  it('throws on malformed ISO input (explicit surface, not silent NaN)', () => {
    expect(() => advanceDueDate('not-a-date', 'monthly')).toThrow(/invalid ISO date/);
    expect(() => advanceDueDate('', 'monthly')).toThrow(/invalid ISO date/);
  });

  it('output is always zero-padded YYYY-MM-DD format', () => {
    const result = advanceDueDate('2026-01-05', 'weekly');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatFrequency', () => {
  it('weekly → "Every {day}" derived from the next due date', () => {
    // 2026-04-20 is a Monday
    expect(formatFrequency('weekly', '2026-04-20')).toBe('Every Monday');
    // 2026-04-26 is a Sunday
    expect(formatFrequency('weekly', '2026-04-26')).toBe('Every Sunday');
  });

  it('biweekly → "Every other {day}" derived from the next due date', () => {
    expect(formatFrequency('biweekly', '2026-04-22')).toBe('Every other Wednesday');
    expect(formatFrequency('biweekly', '2026-04-25')).toBe('Every other Saturday');
  });

  it('monthly variants are static and ignore the date', () => {
    expect(formatFrequency('monthly', '2026-04-22')).toBe('Monthly');
    expect(formatFrequency('monthly_first', '2026-04-01')).toBe('1st of every month');
    expect(formatFrequency('monthly_last', '2026-04-30')).toBe('Last day of every month');
  });

  it('falls back to generic labels on malformed ISO (no throw, UI is forgiving here)', () => {
    expect(formatFrequency('weekly', '')).toBe('Weekly');
    expect(formatFrequency('biweekly', 'not-a-date')).toBe('Biweekly');
  });

  it('covers all seven days of the week for weekly', () => {
    // Week starting 2026-04-19 (Sunday) through 2026-04-25 (Saturday)
    expect(formatFrequency('weekly', '2026-04-19')).toBe('Every Sunday');
    expect(formatFrequency('weekly', '2026-04-20')).toBe('Every Monday');
    expect(formatFrequency('weekly', '2026-04-21')).toBe('Every Tuesday');
    expect(formatFrequency('weekly', '2026-04-22')).toBe('Every Wednesday');
    expect(formatFrequency('weekly', '2026-04-23')).toBe('Every Thursday');
    expect(formatFrequency('weekly', '2026-04-24')).toBe('Every Friday');
    expect(formatFrequency('weekly', '2026-04-25')).toBe('Every Saturday');
  });
});

describe('shouldAdvanceBill', () => {
  it('is true when past due and every included member has paid', () => {
    expect(
      shouldAdvanceBill({ active: true, daysUntilDue: -2, paidCount: 3, includedCount: 3 }),
    ).toBe(true);
  });

  it('is true when due today and fully paid (matches SQL <= today)', () => {
    expect(
      shouldAdvanceBill({ active: true, daysUntilDue: 0, paidCount: 3, includedCount: 3 }),
    ).toBe(true);
  });

  it('is false when due in the future, even if everyone has paid early', () => {
    expect(
      shouldAdvanceBill({ active: true, daysUntilDue: 5, paidCount: 3, includedCount: 3 }),
    ).toBe(false);
  });

  it('is false when one member has not paid', () => {
    expect(
      shouldAdvanceBill({ active: true, daysUntilDue: -2, paidCount: 2, includedCount: 3 }),
    ).toBe(false);
  });

  it('is false when nobody is included (defensive)', () => {
    expect(
      shouldAdvanceBill({ active: true, daysUntilDue: -2, paidCount: 0, includedCount: 0 }),
    ).toBe(false);
  });

  it('is false when the bill is paused (active === false)', () => {
    expect(
      shouldAdvanceBill({ active: false, daysUntilDue: -2, paidCount: 3, includedCount: 3 }),
    ).toBe(false);
  });

  it('the one-way ratchet: true remains true whether or not extra payments exist', () => {
    const exact = shouldAdvanceBill({
      active: true,
      daysUntilDue: -1,
      paidCount: 3,
      includedCount: 3,
    });
    const over = shouldAdvanceBill({
      active: true,
      daysUntilDue: -1,
      paidCount: 4,
      includedCount: 3,
    });
    expect(exact).toBe(true);
    expect(over).toBe(true);
  });
});
