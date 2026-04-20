const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatUSD(amount: number): string {
  return usd.format(amount);
}
