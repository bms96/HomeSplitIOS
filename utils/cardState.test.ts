import {
  computeBillsDueCardState,
  computeOwedToYouCardState,
  computeYouOweCardState,
} from './cardState';

describe('computeYouOweCardState', () => {
  it('is positive when count is 0 and nothing carried over', () => {
    expect(computeYouOweCardState({ count: 0, hasCarryover: false })).toEqual({
      tone: 'positive',
      text: 'All settled up',
    });
  });

  it('is caution when count > 0 and no carryover', () => {
    expect(computeYouOweCardState({ count: 2, hasCarryover: false })).toEqual({
      tone: 'caution',
      text: 'Due this cycle',
    });
  });

  it('is alert when carryover exists, regardless of current count', () => {
    expect(computeYouOweCardState({ count: 0, hasCarryover: true })).toMatchObject({
      tone: 'alert',
    });
    expect(computeYouOweCardState({ count: 5, hasCarryover: true })).toMatchObject({
      tone: 'alert',
    });
  });

  it('carryover wins over current-cycle count (highest-severity rule)', () => {
    const stateWithCarry = computeYouOweCardState({ count: 3, hasCarryover: true });
    const stateCautionOnly = computeYouOweCardState({ count: 3, hasCarryover: false });
    expect(stateWithCarry.tone).toBe('alert');
    expect(stateCautionOnly.tone).toBe('caution');
  });

  it('returns non-empty, screen-reader-friendly text for every state', () => {
    const states = [
      computeYouOweCardState({ count: 0, hasCarryover: false }),
      computeYouOweCardState({ count: 1, hasCarryover: false }),
      computeYouOweCardState({ count: 0, hasCarryover: true }),
      computeYouOweCardState({ count: 1, hasCarryover: true }),
    ];
    for (const s of states) {
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.text.length).toBeLessThanOrEqual(40);
    }
  });
});

describe('computeOwedToYouCardState', () => {
  it('is positive when count is 0 and nothing carried over', () => {
    expect(computeOwedToYouCardState({ count: 0, hasCarryover: false })).toEqual({
      tone: 'positive',
      text: 'Fully reimbursed',
    });
  });

  it('is caution when count > 0 and no carryover', () => {
    expect(computeOwedToYouCardState({ count: 3, hasCarryover: false })).toEqual({
      tone: 'caution',
      text: 'Waiting on roommates',
    });
  });

  it('is alert when carryover exists, regardless of current count', () => {
    expect(computeOwedToYouCardState({ count: 0, hasCarryover: true })).toMatchObject({
      tone: 'alert',
    });
    expect(computeOwedToYouCardState({ count: 7, hasCarryover: true })).toMatchObject({
      tone: 'alert',
    });
  });

  it('is deterministic across identical inputs', () => {
    const a = computeOwedToYouCardState({ count: 2, hasCarryover: false });
    const b = computeOwedToYouCardState({ count: 2, hasCarryover: false });
    expect(a).toEqual(b);
  });

  it('returns non-empty, screen-reader-friendly text for every state', () => {
    const states = [
      computeOwedToYouCardState({ count: 0, hasCarryover: false }),
      computeOwedToYouCardState({ count: 1, hasCarryover: false }),
      computeOwedToYouCardState({ count: 0, hasCarryover: true }),
    ];
    for (const s of states) {
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.text.length).toBeLessThanOrEqual(40);
    }
  });
});

describe('computeBillsDueCardState', () => {
  it('is positive when no bills in window and none overdue', () => {
    expect(computeBillsDueCardState({ count: 0, hasOverdue: false })).toEqual({
      tone: 'positive',
      text: 'All caught up',
    });
  });

  it('is caution when bills are coming up and none overdue', () => {
    expect(computeBillsDueCardState({ count: 2, hasOverdue: false })).toEqual({
      tone: 'caution',
      text: 'Coming up',
    });
  });

  it('is alert when any bill is past due, regardless of count', () => {
    expect(computeBillsDueCardState({ count: 1, hasOverdue: true })).toMatchObject({
      tone: 'alert',
    });
    expect(computeBillsDueCardState({ count: 5, hasOverdue: true })).toMatchObject({
      tone: 'alert',
    });
  });

  it('alert takes priority over caution (overdue + coming up ⇒ alert)', () => {
    expect(computeBillsDueCardState({ count: 4, hasOverdue: true }).tone).toBe('alert');
  });

  it('returns non-empty, screen-reader-friendly text for every state', () => {
    const states = [
      computeBillsDueCardState({ count: 0, hasOverdue: false }),
      computeBillsDueCardState({ count: 2, hasOverdue: false }),
      computeBillsDueCardState({ count: 2, hasOverdue: true }),
    ];
    for (const s of states) {
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.text.length).toBeLessThanOrEqual(40);
    }
  });
});

describe('card state — shared invariants', () => {
  it('every state returns a valid tone enum value', () => {
    const valid = new Set(['positive', 'caution', 'alert']);
    const all = [
      computeYouOweCardState({ count: 0, hasCarryover: false }),
      computeYouOweCardState({ count: 1, hasCarryover: false }),
      computeYouOweCardState({ count: 0, hasCarryover: true }),
      computeOwedToYouCardState({ count: 0, hasCarryover: false }),
      computeOwedToYouCardState({ count: 1, hasCarryover: false }),
      computeOwedToYouCardState({ count: 0, hasCarryover: true }),
      computeBillsDueCardState({ count: 0, hasOverdue: false }),
      computeBillsDueCardState({ count: 1, hasOverdue: false }),
      computeBillsDueCardState({ count: 0, hasOverdue: true }),
    ];
    for (const s of all) {
      expect(valid.has(s.tone)).toBe(true);
    }
  });

  it('severity ordering: positive < caution < alert', () => {
    // Exhaustive matrix: more "bad signals" never lowers severity.
    const severity = { positive: 0, caution: 1, alert: 2 };
    const baseline = computeYouOweCardState({ count: 0, hasCarryover: false });
    const oneSignal = computeYouOweCardState({ count: 1, hasCarryover: false });
    const twoSignals = computeYouOweCardState({ count: 1, hasCarryover: true });
    expect(severity[oneSignal.tone]).toBeGreaterThanOrEqual(severity[baseline.tone]);
    expect(severity[twoSignals.tone]).toBeGreaterThanOrEqual(severity[oneSignal.tone]);
  });
});
