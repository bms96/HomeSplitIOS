import {
  calculateEqualSplits,
  calculateExactSplits,
  calculatePercentSplits,
  sumShares,
  type Share,
} from './splits';

describe('calculateEqualSplits', () => {
  it('returns empty array when there are no members', () => {
    expect(calculateEqualSplits(100, [])).toEqual([]);
  });

  it('assigns the full amount to a single member', () => {
    const splits = calculateEqualSplits(50, ['A']);
    expect(splits).toEqual([{ member_id: 'A', amount_owed: 50 }]);
  });

  it('splits evenly between two members', () => {
    const splits = calculateEqualSplits(100, ['A', 'B']);
    expect(splits[0]!.amount_owed).toBeCloseTo(50, 2);
    expect(splits[1]!.amount_owed).toBeCloseTo(50, 2);
  });

  it('assigns rounding remainder to first member', () => {
    const splits = calculateEqualSplits(10, ['A', 'B', 'C']);
    expect(splits[0]!.amount_owed).toBe(3.34);
    expect(splits[1]!.amount_owed).toBe(3.33);
    expect(splits[2]!.amount_owed).toBe(3.33);
  });

  it('splits always sum to exactly the expense total (invariant)', () => {
    const cases: Array<[number, number]> = [
      [10, 3], [100, 3], [47.5, 4], [0.03, 2], [99.99, 7], [1, 6], [33.33, 3],
    ];
    for (const [amount, count] of cases) {
      const members = Array.from({ length: count }, (_, i) => `M${i}`);
      const splits = calculateEqualSplits(amount, members);
      const total = splits.reduce((acc, s) => acc + s.amount_owed, 0);
      expect(total).toBeCloseTo(amount, 2);
    }
  });

  it('handles $0 expense — every share is zero', () => {
    const splits = calculateEqualSplits(0, ['A', 'B', 'C']);
    expect(splits.every(s => s.amount_owed === 0)).toBe(true);
  });

  it('preserves member order and ids in the output', () => {
    const members = ['alice', 'bob', 'carol', 'dave'];
    const splits = calculateEqualSplits(40, members);
    expect(splits.map(s => s.member_id)).toEqual(members);
  });

  it('first member share is always >= every other share (absorbs remainder)', () => {
    const splits = calculateEqualSplits(10, ['A', 'B', 'C']);
    for (let i = 1; i < splits.length; i++) {
      expect(splits[0]!.amount_owed).toBeGreaterThanOrEqual(splits[i]!.amount_owed);
    }
  });

  it('each share is a finite 2-decimal cent value (no float drift in output)', () => {
    const splits = calculateEqualSplits(10, ['A', 'B', 'C']);
    for (const s of splits) {
      expect(Number.isFinite(s.amount_owed)).toBe(true);
      const cents = Math.round(s.amount_owed * 100);
      expect(Math.abs(s.amount_owed * 100 - cents)).toBeLessThan(1e-9);
    }
  });

  it('is deterministic — identical inputs produce byte-identical outputs', () => {
    const a = calculateEqualSplits(100.07, ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6']);
    const b = calculateEqualSplits(100.07, ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6']);
    expect(a).toEqual(b);
  });

  it('handles negative amounts (refund) — absorbs remainder on first member, sums exact', () => {
    const splits = calculateEqualSplits(-10, ['A', 'B', 'C']);
    const total = splits.reduce((acc, s) => acc + s.amount_owed, 0);
    expect(total).toBeCloseTo(-10, 2);
    // First member absorbs the remainder; every other share equals the floor-base.
    const base = splits[1]!.amount_owed;
    expect(splits[2]!.amount_owed).toBe(base);
    expect(splits[0]!.amount_owed).not.toBe(base);
  });

  it('handles tiny sub-cent refund (-$0.01 across 3) without losing the cent', () => {
    const splits = calculateEqualSplits(-0.01, ['A', 'B', 'C']);
    const total = splits.reduce((acc, s) => acc + s.amount_owed, 0);
    expect(total).toBeCloseTo(-0.01, 2);
  });

  it('handles exact division with no remainder', () => {
    const splits = calculateEqualSplits(99, ['A', 'B', 'C']);
    expect(splits.every(s => s.amount_owed === 33)).toBe(true);
  });

  it('handles large household (10 members, awkward total)', () => {
    const members = Array.from({ length: 10 }, (_, i) => `M${i}`);
    const splits = calculateEqualSplits(100.07, members);
    const total = splits.reduce((acc, s) => acc + s.amount_owed, 0);
    expect(total).toBeCloseTo(100.07, 2);
    expect(splits).toHaveLength(10);
  });
});

describe('calculatePercentSplits', () => {
  it('returns empty array when there are no shares', () => {
    expect(calculatePercentSplits(100, [])).toEqual([]);
  });

  it('splits cleanly when percentages divide evenly', () => {
    const splits = calculatePercentSplits(100, [
      { member_id: 'A', value: 50 },
      { member_id: 'B', value: 50 },
    ]);
    expect(splits).toEqual([
      { member_id: 'A', amount_owed: 50 },
      { member_id: 'B', amount_owed: 50 },
    ]);
  });

  it('handles asymmetric percentages (60/30/10)', () => {
    const splits = calculatePercentSplits(1000, [
      { member_id: 'A', value: 60 },
      { member_id: 'B', value: 30 },
      { member_id: 'C', value: 10 },
    ]);
    expect(splits).toEqual([
      { member_id: 'A', amount_owed: 600 },
      { member_id: 'B', amount_owed: 300 },
      { member_id: 'C', amount_owed: 100 },
    ]);
  });

  it('absorbs sub-cent remainder on first share (33/33/34 of $10 = rounded)', () => {
    const splits = calculatePercentSplits(10, [
      { member_id: 'A', value: 33 },
      { member_id: 'B', value: 33 },
      { member_id: 'C', value: 34 },
    ]);
    const total = splits.reduce((acc, s) => acc + s.amount_owed, 0);
    expect(total).toBeCloseTo(10, 2);
  });

  it('splits always sum to exactly the bill amount (invariant across awkward inputs)', () => {
    const cases: Array<{ amount: number; shares: Share[] }> = [
      {
        amount: 47.5,
        shares: [
          { member_id: 'A', value: 33.33 },
          { member_id: 'B', value: 33.33 },
          { member_id: 'C', value: 33.34 },
        ],
      },
      {
        amount: 99.99,
        shares: [
          { member_id: 'A', value: 45 },
          { member_id: 'B', value: 35 },
          { member_id: 'C', value: 20 },
        ],
      },
      {
        amount: 0.07,
        shares: [
          { member_id: 'A', value: 50 },
          { member_id: 'B', value: 50 },
        ],
      },
    ];
    for (const c of cases) {
      const total = calculatePercentSplits(c.amount, c.shares).reduce(
        (acc, s) => acc + s.amount_owed,
        0,
      );
      expect(total).toBeCloseTo(c.amount, 2);
    }
  });

  it('preserves member order and ids', () => {
    const shares: Share[] = [
      { member_id: 'alice', value: 25 },
      { member_id: 'bob', value: 25 },
      { member_id: 'carol', value: 50 },
    ];
    const splits = calculatePercentSplits(100, shares);
    expect(splits.map((s) => s.member_id)).toEqual(['alice', 'bob', 'carol']);
  });

  it('handles $0 bill — every share is zero', () => {
    const splits = calculatePercentSplits(0, [
      { member_id: 'A', value: 60 },
      { member_id: 'B', value: 40 },
    ]);
    expect(splits.every((s) => s.amount_owed === 0)).toBe(true);
  });

  it('handles 100% assigned to a single member', () => {
    const splits = calculatePercentSplits(250, [{ member_id: 'A', value: 100 }]);
    expect(splits).toEqual([{ member_id: 'A', amount_owed: 250 }]);
  });

  it('each share is a finite 2-decimal cent value', () => {
    const splits = calculatePercentSplits(100.07, [
      { member_id: 'A', value: 33.33 },
      { member_id: 'B', value: 33.33 },
      { member_id: 'C', value: 33.34 },
    ]);
    for (const s of splits) {
      expect(Number.isFinite(s.amount_owed)).toBe(true);
      const cents = Math.round(s.amount_owed * 100);
      expect(Math.abs(s.amount_owed * 100 - cents)).toBeLessThan(1e-9);
    }
  });
});

describe('calculateExactSplits', () => {
  it('returns empty array when there are no shares', () => {
    expect(calculateExactSplits([])).toEqual([]);
  });

  it('passes through exact amounts (caller already validated sum)', () => {
    const splits = calculateExactSplits([
      { member_id: 'A', value: 40 },
      { member_id: 'B', value: 12.5 },
    ]);
    expect(splits).toEqual([
      { member_id: 'A', amount_owed: 40 },
      { member_id: 'B', amount_owed: 12.5 },
    ]);
  });

  it('normalizes to 2 decimals (strips float drift)', () => {
    const splits = calculateExactSplits([
      { member_id: 'A', value: 0.1 + 0.2 }, // 0.30000000000000004
    ]);
    expect(splits[0]!.amount_owed).toBe(0.3);
  });

  it('preserves member order and ids', () => {
    const splits = calculateExactSplits([
      { member_id: 'z', value: 1 },
      { member_id: 'a', value: 2 },
      { member_id: 'm', value: 3 },
    ]);
    expect(splits.map((s) => s.member_id)).toEqual(['z', 'a', 'm']);
  });

  it('handles zero-valued members (included but owes nothing)', () => {
    const splits = calculateExactSplits([
      { member_id: 'A', value: 100 },
      { member_id: 'B', value: 0 },
    ]);
    expect(splits[1]!.amount_owed).toBe(0);
  });
});

describe('sumShares', () => {
  it('returns 0 for an empty array', () => {
    expect(sumShares([])).toBe(0);
  });

  it('sums integer values', () => {
    expect(
      sumShares([
        { member_id: 'A', value: 60 },
        { member_id: 'B', value: 40 },
      ]),
    ).toBe(100);
  });

  it('rounds float drift to 2 decimals (0.1 + 0.2 → 0.30)', () => {
    expect(
      sumShares([
        { member_id: 'A', value: 0.1 },
        { member_id: 'B', value: 0.2 },
      ]),
    ).toBe(0.3);
  });

  it('sums fractional percentages exactly (33.33 + 33.33 + 33.34 = 100)', () => {
    expect(
      sumShares([
        { member_id: 'A', value: 33.33 },
        { member_id: 'B', value: 33.33 },
        { member_id: 'C', value: 33.34 },
      ]),
    ).toBe(100);
  });
});

