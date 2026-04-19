import { isBillEffectivelyOverdue, isBillFullyPaid } from './billStatus';

describe('isBillFullyPaid', () => {
  it('is true when every included member has paid', () => {
    expect(isBillFullyPaid({ paidCount: 3, includedCount: 3 })).toBe(true);
  });

  it('is false when one included member has not paid', () => {
    expect(isBillFullyPaid({ paidCount: 2, includedCount: 3 })).toBe(false);
  });

  it('is false when nobody has paid', () => {
    expect(isBillFullyPaid({ paidCount: 0, includedCount: 3 })).toBe(false);
  });

  it('is true when extra payments somehow exist (defensive)', () => {
    // Shouldn't happen (unique constraint on payments) but don't flip to false.
    expect(isBillFullyPaid({ paidCount: 4, includedCount: 3 })).toBe(true);
  });

  it('is false when no members are included (vacuous-truth guard)', () => {
    expect(isBillFullyPaid({ paidCount: 0, includedCount: 0 })).toBe(false);
  });

  it('is false when includedCount is negative (defensive)', () => {
    expect(isBillFullyPaid({ paidCount: 0, includedCount: -1 })).toBe(false);
  });
});

describe('isBillEffectivelyOverdue', () => {
  it('is false when due date is in the future', () => {
    expect(
      isBillEffectivelyOverdue({ daysUntilDue: 5, paidCount: 0, includedCount: 3 }),
    ).toBe(false);
  });

  it('is false when due date is today (day 0 is not overdue)', () => {
    expect(
      isBillEffectivelyOverdue({ daysUntilDue: 0, paidCount: 0, includedCount: 3 }),
    ).toBe(false);
  });

  it('is true when past due and at least one member has not paid', () => {
    expect(
      isBillEffectivelyOverdue({ daysUntilDue: -2, paidCount: 2, includedCount: 3 }),
    ).toBe(true);
  });

  it('is false when past due but every included member has paid', () => {
    expect(
      isBillEffectivelyOverdue({ daysUntilDue: -2, paidCount: 3, includedCount: 3 }),
    ).toBe(false);
  });

  it('is false when past due but nobody is included (no one to be overdue)', () => {
    expect(
      isBillEffectivelyOverdue({ daysUntilDue: -5, paidCount: 0, includedCount: 0 }),
    ).toBe(false);
  });

  it('is true when only one member remains unpaid and it is past due', () => {
    expect(
      isBillEffectivelyOverdue({ daysUntilDue: -1, paidCount: 3, includedCount: 4 }),
    ).toBe(true);
  });

  it('is false the instant the last unpaid member pays (past-due edge case)', () => {
    // Regression: rent is 2 days overdue, roommate 3/3 marks paid — bill
    // should immediately stop reading as "overdue" even before the daily
    // cron rolls next_due_date forward.
    const before = isBillEffectivelyOverdue({
      daysUntilDue: -2,
      paidCount: 2,
      includedCount: 3,
    });
    const after = isBillEffectivelyOverdue({
      daysUntilDue: -2,
      paidCount: 3,
      includedCount: 3,
    });
    expect(before).toBe(true);
    expect(after).toBe(false);
  });
});
