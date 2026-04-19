export type Debt = {
  from: string;
  to: string;
  amount: number;
};

/**
 * Greedy debt simplification. Given a list of "A owes B X" entries, reduces them
 * to the minimum set of transactions that settles every member's net balance.
 *
 * Each member's balance is computed (positive = owed money, negative = owes money),
 * then the largest creditor is paid by the largest debtor iteratively.
 */
export function simplifyDebts(debts: Debt[]): Debt[] {
  const balance: Record<string, number> = {};
  for (const d of debts) {
    balance[d.from] = (balance[d.from] ?? 0) - d.amount;
    balance[d.to] = (balance[d.to] ?? 0) + d.amount;
  }

  const creditors = Object.entries(balance)
    .filter(([, v]) => v > 0.01)
    .sort((a, b) => b[1] - a[1]);
  const debtors = Object.entries(balance)
    .filter(([, v]) => v < -0.01)
    .sort((a, b) => a[1] - b[1]);

  const result: Debt[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!;
    const debtor = debtors[di]!;
    const settled = parseFloat(Math.min(creditor[1], -debtor[1]).toFixed(2));
    if (settled > 0) {
      result.push({ from: debtor[0], to: creditor[0], amount: settled });
    }
    creditor[1] -= settled;
    debtor[1] += settled;
    if (creditor[1] < 0.01) ci++;
    if (debtor[1] > -0.01) di++;
  }
  return result;
}

/**
 * Nets each unordered pair of members to a single debt. Unlike simplifyDebts,
 * this never routes through intermediaries — every returned edge corresponds
 * to real expense_splits between those two members, so settle_pair can
 * actually clear them.
 */
export function computePairwiseDebts(debts: Debt[]): Debt[] {
  const pair: Record<string, number> = {};
  const dir: Record<string, [string, string]> = {};
  for (const d of debts) {
    const [a, b] = d.from < d.to ? [d.from, d.to] : [d.to, d.from];
    const key = `${a}|${b}`;
    const signed = d.from === a ? d.amount : -d.amount;
    pair[key] = (pair[key] ?? 0) + signed;
    dir[key] = [a, b];
  }
  const result: Debt[] = [];
  for (const [key, net] of Object.entries(pair)) {
    const [a, b] = dir[key]!;
    const amount = parseFloat(Math.abs(net).toFixed(2));
    if (amount < 0.01) continue;
    result.push(net > 0 ? { from: a, to: b, amount } : { from: b, to: a, amount });
  }
  return result;
}

export type MemberNetBalance = {
  member_id: string;
  net: number;
};

/**
 * Computes each member's net balance from unsettled splits.
 * net > 0 → owed money; net < 0 → owes money.
 */
export function computeNetBalances(
  splits: { member_id: string; amount_owed: number; paid_by_member_id: string }[],
): MemberNetBalance[] {
  const balance: Record<string, number> = {};
  for (const s of splits) {
    if (s.member_id === s.paid_by_member_id) continue;
    balance[s.paid_by_member_id] = (balance[s.paid_by_member_id] ?? 0) + s.amount_owed;
    balance[s.member_id] = (balance[s.member_id] ?? 0) - s.amount_owed;
  }
  return Object.entries(balance).map(([member_id, net]) => ({
    member_id,
    net: parseFloat(net.toFixed(2)),
  }));
}
