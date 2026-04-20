import { formatUSD } from './currency';

describe('formatUSD', () => {
  it('formats whole dollars with two decimals and a $ sign', () => {
    expect(formatUSD(47)).toBe('$47.00');
  });

  it('rounds to two decimals', () => {
    expect(formatUSD(12.345)).toBe('$12.35');
  });

  it('inserts thousands separators', () => {
    expect(formatUSD(1234567.89)).toBe('$1,234,567.89');
  });

  it('formats zero', () => {
    expect(formatUSD(0)).toBe('$0.00');
  });

  it('formats negative amounts with a leading minus', () => {
    expect(formatUSD(-42.5)).toBe('-$42.50');
  });

  it('pads sub-cent fractions up to two decimals', () => {
    expect(formatUSD(3.1)).toBe('$3.10');
  });

  it('formats large negative amounts with thousands separators', () => {
    expect(formatUSD(-1234567.89)).toBe('-$1,234,567.89');
  });
});
