import {
  buildCashAppUrl,
  buildInviteDeepLink,
  buildInviteUrl,
  buildVenmoUrl,
} from './deeplinks';

describe('buildInviteUrl', () => {
  it('builds a universal https link with the invite token', () => {
    expect(buildInviteUrl('abc123')).toBe('https://homesplit.app/join/abc123');
  });
});

describe('buildInviteDeepLink', () => {
  it('builds a custom-scheme deep link with the invite token', () => {
    expect(buildInviteDeepLink('abc123')).toBe('homesplit://join/abc123');
  });
});

describe('buildVenmoUrl', () => {
  it('formats amount to two decimals', () => {
    const url = buildVenmoUrl({ amount: 42, note: 'rent', recipient: 'alice' });
    expect(url).toContain('amount=42.00');
  });

  it('URL-encodes the note', () => {
    const url = buildVenmoUrl({ amount: 10, note: 'May rent & utilities' });
    expect(url).toContain('note=May%20rent%20%26%20utilities');
  });

  it('URL-encodes the recipient username', () => {
    const url = buildVenmoUrl({ amount: 10, note: 'n', recipient: 'user name' });
    expect(url).toContain('recipients=user%20name');
  });

  it('omits recipient query when not provided', () => {
    const url = buildVenmoUrl({ amount: 10, note: 'n' });
    expect(url).not.toContain('recipients=');
    expect(url.startsWith('venmo://paycharge?txn=pay&amount=')).toBe(true);
  });

  it('rounds fractional cents in the amount', () => {
    const url = buildVenmoUrl({ amount: 12.345, note: 'n' });
    expect(url).toContain('amount=12.35');
  });

  it('URL-encodes unicode characters in the note and survives a decode roundtrip', () => {
    const url = buildVenmoUrl({ amount: 10, note: "May's rent 🏠" });
    // Raw unicode must not appear — it must be percent-encoded.
    expect(url).not.toContain('🏠');
    expect(url).toContain('note=');
    const noteParam = url.split('note=')[1]!;
    expect(decodeURIComponent(noteParam)).toBe("May's rent 🏠");
  });

  it('formats a $0.00 amount (e.g. fully settled — edge case)', () => {
    const url = buildVenmoUrl({ amount: 0, note: 'settled' });
    expect(url).toContain('amount=0.00');
  });
});

describe('buildCashAppUrl', () => {
  it('builds a URL with cashtag and amount formatted to two decimals', () => {
    const url = buildCashAppUrl({ amount: 25, cashtag: 'alice' });
    expect(url).toBe('https://cash.app/$alice/25.00');
  });

  it('URL-encodes the cashtag', () => {
    const url = buildCashAppUrl({ amount: 1, cashtag: 'a b' });
    expect(url).toBe('https://cash.app/$a%20b/1.00');
  });

  it('falls back to the Cash App home page when no cashtag is provided', () => {
    const url = buildCashAppUrl({ amount: 25 });
    expect(url).toBe('https://cash.app');
  });
});
