import { computeNetBalances, computePairwiseDebts, simplifyDebts, type Debt } from './debts';

const sumAmounts = (debts: Debt[]) => debts.reduce((acc, d) => acc + d.amount, 0);

const netFromDebts = (debts: Debt[]) => {
  const net: Record<string, number> = {};
  for (const d of debts) {
    net[d.from] = (net[d.from] ?? 0) - d.amount;
    net[d.to] = (net[d.to] ?? 0) + d.amount;
  }
  return net;
};

describe('simplifyDebts', () => {
  it('returns empty array for empty input', () => {
    expect(simplifyDebts([])).toEqual([]);
  });

  it('passes through a single two-person debt unchanged', () => {
    const result = simplifyDebts([{ from: 'A', to: 'B', amount: 50 }]);
    expect(result).toEqual([{ from: 'A', to: 'B', amount: 50 }]);
  });

  it('nets mutual debts to the difference in the correct direction', () => {
    const result = simplifyDebts([
      { from: 'A', to: 'B', amount: 30 },
      { from: 'B', to: 'A', amount: 20 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ from: 'A', to: 'B', amount: 10 });
  });

  it('returns empty array when all debts cancel out exactly', () => {
    const result = simplifyDebts([
      { from: 'A', to: 'B', amount: 25 },
      { from: 'B', to: 'A', amount: 25 },
    ]);
    expect(result).toEqual([]);
  });

  it('collapses a three-person chain A→B→C into A→C', () => {
    const result = simplifyDebts([
      { from: 'A', to: 'B', amount: 50 },
      { from: 'B', to: 'C', amount: 50 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ from: 'A', to: 'C', amount: 50 });
  });

  it('preserves aggregate balance across transformations', () => {
    const debts: Debt[] = [
      { from: 'A', to: 'B', amount: 40 },
      { from: 'C', to: 'B', amount: 20 },
      { from: 'A', to: 'D', amount: 10 },
    ];
    const result = simplifyDebts(debts);
    const before = netFromDebts(debts);
    const after = netFromDebts(result);
    for (const member of Object.keys(before)) {
      expect(after[member] ?? 0).toBeCloseTo(before[member] ?? 0, 2);
    }
  });

  it('never produces more transactions than N-1 for N members', () => {
    const debts: Debt[] = [
      { from: 'A', to: 'B', amount: 40 },
      { from: 'C', to: 'B', amount: 20 },
      { from: 'A', to: 'D', amount: 10 },
      { from: 'D', to: 'C', amount: 5 },
    ];
    const result = simplifyDebts(debts);
    const members = new Set<string>();
    debts.forEach(d => { members.add(d.from); members.add(d.to); });
    expect(result.length).toBeLessThanOrEqual(members.size - 1);
  });

  it('pairs largest debtor with largest creditor (greedy invariant)', () => {
    const result = simplifyDebts([
      { from: 'A', to: 'C', amount: 100 },
      { from: 'B', to: 'C', amount: 10 },
    ]);
    const toC = result.filter(d => d.to === 'C');
    const fromA = toC.find(d => d.from === 'A');
    expect(fromA?.amount).toBeCloseTo(100, 2);
  });

  it('suppresses debts below the 1¢ threshold', () => {
    const result = simplifyDebts([{ from: 'A', to: 'B', amount: 0.005 }]);
    expect(result).toEqual([]);
  });

  it('handles fractional cent rounding without drift', () => {
    const result = simplifyDebts([
      { from: 'A', to: 'B', amount: 10.005 },
      { from: 'B', to: 'C', amount: 10.005 },
    ]);
    const net = netFromDebts(result);
    expect(net.A ?? 0).toBeLessThanOrEqual(0);
    expect(net.C ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('never emits a self-loop (from === to)', () => {
    const result = simplifyDebts([
      { from: 'A', to: 'B', amount: 50 },
      { from: 'B', to: 'A', amount: 30 },
      { from: 'A', to: 'C', amount: 40 },
    ]);
    for (const d of result) {
      expect(d.from).not.toBe(d.to);
    }
  });

  it('emits only positive amounts', () => {
    const result = simplifyDebts([
      { from: 'A', to: 'B', amount: 25 },
      { from: 'C', to: 'D', amount: 15 },
      { from: 'B', to: 'A', amount: 5 },
    ]);
    for (const d of result) {
      expect(d.amount).toBeGreaterThan(0);
    }
  });

  it('does not mutate the input array', () => {
    const debts: Debt[] = [
      { from: 'A', to: 'B', amount: 30 },
      { from: 'B', to: 'A', amount: 20 },
    ];
    const snapshot = JSON.parse(JSON.stringify(debts));
    simplifyDebts(debts);
    expect(debts).toEqual(snapshot);
  });

  it('handles large households (six members, many debts)', () => {
    const debts: Debt[] = [
      { from: 'A', to: 'B', amount: 100 },
      { from: 'A', to: 'C', amount: 50 },
      { from: 'B', to: 'D', amount: 75 },
      { from: 'C', to: 'E', amount: 40 },
      { from: 'D', to: 'F', amount: 20 },
      { from: 'E', to: 'A', amount: 30 },
      { from: 'F', to: 'B', amount: 10 },
    ];
    const result = simplifyDebts(debts);
    const before = netFromDebts(debts);
    const after = netFromDebts(result);
    for (const member of ['A', 'B', 'C', 'D', 'E', 'F']) {
      expect(after[member] ?? 0).toBeCloseTo(before[member] ?? 0, 2);
    }
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('FP stress: many tiny third-cent debts do not drift the ledger', () => {
    // 300 debts of $0.33 from A→B is $99.00 owed; inverse also clean.
    // Using 1/3 directly forces repeated float accumulation.
    const debts: Debt[] = Array.from({ length: 300 }, () => ({
      from: 'A',
      to: 'B',
      amount: 1 / 3,
    }));
    const result = simplifyDebts(debts);
    const moved = sumAmounts(result);
    expect(moved).toBeCloseTo(100, 1);
    expect(result).toHaveLength(1);
    expect(result[0]!.from).toBe('A');
    expect(result[0]!.to).toBe('B');
  });

  it('FP stress: creditor balance never goes negative during greedy pass', () => {
    // Chain of many small debts converging on one creditor.
    const debts: Debt[] = [];
    for (let i = 0; i < 50; i++) {
      debts.push({ from: `D${i}`, to: 'C', amount: 7.77 });
    }
    const result = simplifyDebts(debts);
    const creditorTotal = result
      .filter((d) => d.to === 'C')
      .reduce((acc, d) => acc + d.amount, 0);
    expect(creditorTotal).toBeCloseTo(7.77 * 50, 2);
    // No individual emitted debt should exceed what C was actually owed.
    for (const d of result) {
      expect(d.amount).toBeLessThanOrEqual(7.77 * 50 + 0.01);
    }
  });

  it('total amount moved equals sum of creditor balances', () => {
    const debts: Debt[] = [
      { from: 'A', to: 'B', amount: 40 },
      { from: 'C', to: 'B', amount: 20 },
      { from: 'A', to: 'D', amount: 10 },
    ];
    const result = simplifyDebts(debts);
    const net = netFromDebts(debts);
    const totalOwed = Object.values(net).filter(v => v > 0).reduce((a, b) => a + b, 0);
    expect(sumAmounts(result)).toBeCloseTo(totalOwed, 2);
  });
});

describe('computePairwiseDebts', () => {
  it('returns empty array for empty input', () => {
    expect(computePairwiseDebts([])).toEqual([]);
  });

  it('passes through a single debt unchanged', () => {
    expect(computePairwiseDebts([{ from: 'A', to: 'B', amount: 50 }])).toEqual([
      { from: 'A', to: 'B', amount: 50 },
    ]);
  });

  it('nets mutual debts between a pair to the residual direction', () => {
    const result = computePairwiseDebts([
      { from: 'A', to: 'B', amount: 30 },
      { from: 'B', to: 'A', amount: 20 },
    ]);
    expect(result).toEqual([{ from: 'A', to: 'B', amount: 10 }]);
  });

  it('drops pairs that fully cancel out', () => {
    const result = computePairwiseDebts([
      { from: 'A', to: 'B', amount: 25 },
      { from: 'B', to: 'A', amount: 25 },
    ]);
    expect(result).toEqual([]);
  });

  it('never chains across members (A→B, B→C stays two edges)', () => {
    const result = computePairwiseDebts([
      { from: 'A', to: 'B', amount: 50 },
      { from: 'B', to: 'C', amount: 50 },
    ]);
    expect(result).toHaveLength(2);
    const pairs = result.map((d) => [d.from, d.to].sort().join('|')).sort();
    expect(pairs).toEqual(['A|B', 'B|C']);
  });

  it('aggregates multiple debts within the same pair', () => {
    const result = computePairwiseDebts([
      { from: 'A', to: 'B', amount: 10 },
      { from: 'A', to: 'B', amount: 15 },
      { from: 'B', to: 'A', amount: 5 },
    ]);
    expect(result).toEqual([{ from: 'A', to: 'B', amount: 20 }]);
  });

  it('preserves each pair independently with multiple members', () => {
    const result = computePairwiseDebts([
      { from: 'A', to: 'B', amount: 40 },
      { from: 'C', to: 'B', amount: 20 },
      { from: 'A', to: 'D', amount: 10 },
    ]);
    expect(result).toHaveLength(3);
    const find = (from: string, to: string) =>
      result.find((d) => d.from === from && d.to === to);
    expect(find('A', 'B')?.amount).toBe(40);
    expect(find('C', 'B')?.amount).toBe(20);
    expect(find('A', 'D')?.amount).toBe(10);
  });

  it('suppresses sub-cent residuals below the 1¢ threshold', () => {
    const result = computePairwiseDebts([
      { from: 'A', to: 'B', amount: 10 },
      { from: 'B', to: 'A', amount: 9.999 },
    ]);
    expect(result).toEqual([]);
  });

  it('rounds each emitted amount to two decimals', () => {
    const result = computePairwiseDebts([
      { from: 'A', to: 'B', amount: 10.005 },
    ]);
    expect(result[0]!.amount).toBe(10.01);
  });

  it('does not mutate the input array', () => {
    const debts: Debt[] = [
      { from: 'A', to: 'B', amount: 30 },
      { from: 'B', to: 'A', amount: 20 },
    ];
    const snapshot = JSON.parse(JSON.stringify(debts));
    computePairwiseDebts(debts);
    expect(debts).toEqual(snapshot);
  });
});

describe('computeNetBalances', () => {
  it('returns empty array when there are no splits', () => {
    expect(computeNetBalances([])).toEqual([]);
  });

  it('ignores splits where member owes themselves', () => {
    const result = computeNetBalances([
      { member_id: 'A', paid_by_member_id: 'A', amount_owed: 25 },
    ]);
    expect(result).toEqual([]);
  });

  // Regression: when an expense is split equally across all participants, the
  // payer gets their own split row (amount_owed > 0). That row must be a no-op
  // for the ledger — the payer does not owe themselves. Without the self-split
  // filter, a $60 dinner split 3 ways would inflate the payer's credit from
  // $40 to $60 and leave the ledger unbalanced.
  it('excludes payer self-split from net balances (three-way equal split)', () => {
    const result = computeNetBalances([
      { member_id: 'A', paid_by_member_id: 'A', amount_owed: 20 },
      { member_id: 'B', paid_by_member_id: 'A', amount_owed: 20 },
      { member_id: 'C', paid_by_member_id: 'A', amount_owed: 20 },
    ]);
    const byMember = Object.fromEntries(result.map(r => [r.member_id, r.net]));
    expect(byMember.A).toBeCloseTo(40, 2);
    expect(byMember.B).toBeCloseTo(-20, 2);
    expect(byMember.C).toBeCloseTo(-20, 2);
    const total = result.reduce((acc, r) => acc + r.net, 0);
    expect(total).toBeCloseTo(0, 2);
  });

  it('excludes payer self-split when payer is also a debtor on another expense', () => {
    const result = computeNetBalances([
      { member_id: 'A', paid_by_member_id: 'A', amount_owed: 30 },
      { member_id: 'B', paid_by_member_id: 'A', amount_owed: 30 },
      { member_id: 'A', paid_by_member_id: 'B', amount_owed: 15 },
      { member_id: 'B', paid_by_member_id: 'B', amount_owed: 15 },
    ]);
    const byMember = Object.fromEntries(result.map(r => [r.member_id, r.net]));
    expect(byMember.A).toBeCloseTo(15, 2);
    expect(byMember.B).toBeCloseTo(-15, 2);
  });

  it('credits the payer and debits the owing member', () => {
    const result = computeNetBalances([
      { member_id: 'B', paid_by_member_id: 'A', amount_owed: 30 },
    ]);
    const byMember = Object.fromEntries(result.map(r => [r.member_id, r.net]));
    expect(byMember.A).toBeCloseTo(30, 2);
    expect(byMember.B).toBeCloseTo(-30, 2);
  });

  it('aggregates across multiple splits for the same members', () => {
    const result = computeNetBalances([
      { member_id: 'B', paid_by_member_id: 'A', amount_owed: 10 },
      { member_id: 'B', paid_by_member_id: 'A', amount_owed: 15 },
      { member_id: 'A', paid_by_member_id: 'B', amount_owed: 5 },
    ]);
    const byMember = Object.fromEntries(result.map(r => [r.member_id, r.net]));
    expect(byMember.A).toBeCloseTo(20, 2);
    expect(byMember.B).toBeCloseTo(-20, 2);
  });

  it('net balances sum to zero (conservation of money)', () => {
    const result = computeNetBalances([
      { member_id: 'B', paid_by_member_id: 'A', amount_owed: 12.34 },
      { member_id: 'C', paid_by_member_id: 'A', amount_owed: 7.66 },
      { member_id: 'A', paid_by_member_id: 'C', amount_owed: 3.5 },
    ]);
    const total = result.reduce((acc, r) => acc + r.net, 0);
    expect(total).toBeCloseTo(0, 2);
  });

  it('rounds each net to two decimals', () => {
    const result = computeNetBalances([
      { member_id: 'B', paid_by_member_id: 'A', amount_owed: 1 / 3 },
      { member_id: 'C', paid_by_member_id: 'A', amount_owed: 1 / 3 },
    ]);
    for (const r of result) {
      const rounded = parseFloat(r.net.toFixed(2));
      expect(r.net).toBe(rounded);
    }
  });
});
