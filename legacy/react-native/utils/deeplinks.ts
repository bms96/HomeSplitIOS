/**
 * Universal link — opens the app if installed, falls back to the web site otherwise.
 * Prefer this for shareable links that reach people who might not have the app yet.
 */
export function buildInviteUrl(token: string): string {
  return `https://homesplit.app/join/${token}`;
}

/**
 * Custom-scheme deep link — only resolves inside the app.
 * Use for in-app navigation when the app is confirmed open.
 */
export function buildInviteDeepLink(token: string): string {
  return `homesplit://join/${token}`;
}

/**
 * Venmo payment request. Opens the Venmo app if installed.
 * `recipient` is the Venmo username (without the leading @).
 */
export function buildVenmoUrl(params: {
  amount: number;
  note: string;
  recipient?: string;
}): string {
  const base = params.recipient
    ? `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(params.recipient)}`
    : 'venmo://paycharge?txn=pay';
  return `${base}&amount=${params.amount.toFixed(2)}&note=${encodeURIComponent(params.note)}`;
}

/**
 * Cash App payment link. Opens Cash App if installed, falls back to the web page.
 * `cashtag` is the $username (without the leading $).
 */
export function buildCashAppUrl(params: {
  amount: number;
  cashtag?: string;
}): string {
  return params.cashtag
    ? `https://cash.app/$${encodeURIComponent(params.cashtag)}/${params.amount.toFixed(2)}`
    : 'https://cash.app';
}
