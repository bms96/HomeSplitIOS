export type Split = {
  member_id: string;
  amount_owed: number;
};

export type Share = {
  member_id: string;
  value: number;
};

/**
 * Equal-split calculator. First member absorbs the sub-cent rounding remainder
 * so the returned splits always sum to exactly `amount`.
 */
export function calculateEqualSplits(amount: number, memberIds: string[]): Split[] {
  if (memberIds.length === 0) return [];
  const base = Math.floor((amount / memberIds.length) * 100) / 100;
  const remainder = parseFloat((amount - base * memberIds.length).toFixed(2));
  return memberIds.map((id, i) => ({
    member_id: id,
    amount_owed: i === 0 ? parseFloat((base + remainder).toFixed(2)) : base,
  }));
}

/**
 * Percentage-split calculator. Caller supplies `[{member_id, value}]` where
 * `value` is a percentage; the caller is responsible for enforcing the
 * sum-to-100 invariant at the form boundary. First share absorbs the sub-cent
 * rounding remainder so the returned splits sum to exactly `amount`.
 */
export function calculatePercentSplits(amount: number, shares: Share[]): Split[] {
  if (shares.length === 0) return [];
  const base = shares.map((s) => Math.floor((amount * s.value) / 100 * 100) / 100);
  const sum = base.reduce((acc, v) => acc + v, 0);
  const remainder = parseFloat((amount - sum).toFixed(2));
  return shares.map((s, i) => ({
    member_id: s.member_id,
    amount_owed: i === 0 ? parseFloat((base[i]! + remainder).toFixed(2)) : base[i]!,
  }));
}

/**
 * Exact-amount split calculator. Caller supplies `[{member_id, value}]` where
 * `value` is a dollar amount; the caller is responsible for enforcing the
 * sum-to-amount invariant at the form boundary. This calculator trusts the
 * input and just normalizes to 2 decimals — there is no rounding remainder
 * to distribute because the values are already in cents.
 */
export function calculateExactSplits(shares: Share[]): Split[] {
  return shares.map((s) => ({
    member_id: s.member_id,
    amount_owed: parseFloat(s.value.toFixed(2)),
  }));
}

/** Sum of the `value` field on a `Share[]`, rounded to 2 decimals. */
export function sumShares(shares: Share[]): number {
  return parseFloat(shares.reduce((acc, s) => acc + s.value, 0).toFixed(2));
}
