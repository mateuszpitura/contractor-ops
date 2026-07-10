import { describe, expect, it } from 'vitest';
import { isExpired } from '../expiry';

describe('isExpired — TZ-aware expiry boundary (D-07 / ROADMAP success criterion #2)', () => {
  it('Riyadh contractor: expiresAt = today, now = today 00:30 UTC (= 03:30 Riyadh) → NOT expired', () => {
    const now = new Date('2026-04-27T00:30:00.000Z');
    const expiresAt = new Date('2026-04-27T00:00:00.000Z');
    expect(isExpired(expiresAt, 'Asia/Riyadh', now)).toBe(false);
  });

  it('Riyadh contractor: expiresAt = today, now = next day 00:30 UTC (= 03:30 Riyadh next day) → expired', () => {
    const now = new Date('2026-04-28T00:30:00.000Z');
    const expiresAt = new Date('2026-04-27T00:00:00.000Z');
    expect(isExpired(expiresAt, 'Asia/Riyadh', now)).toBe(true);
  });

  it('London contractor: expiresAt = today, now = today 23:30 UTC (= 00:30 next day BST) → expired during BST', () => {
    // BST is UTC+1 in late April
    const now = new Date('2026-04-27T23:30:00.000Z');
    const expiresAt = new Date('2026-04-27T00:00:00.000Z');
    expect(isExpired(expiresAt, 'Europe/London', now)).toBe(true);
  });

  it('Honolulu (UTC-10): expiresAt = today, now = today 00:30 UTC (= 14:30 prev day Honolulu) → NOT expired', () => {
    const now = new Date('2026-04-27T00:30:00.000Z');
    const expiresAt = new Date('2026-04-27T00:00:00.000Z');
    expect(isExpired(expiresAt, 'Pacific/Honolulu', now)).toBe(false);
  });

  it('Berlin contractor: expiresAt = yesterday → expired', () => {
    const now = new Date('2026-04-27T12:00:00.000Z');
    const expiresAt = new Date('2026-04-26T00:00:00.000Z');
    expect(isExpired(expiresAt, 'Europe/Berlin', now)).toBe(true);
  });

  it('Warsaw contractor: expiresAt = tomorrow → NOT expired', () => {
    const now = new Date('2026-04-27T12:00:00.000Z');
    const expiresAt = new Date('2026-04-28T00:00:00.000Z');
    expect(isExpired(expiresAt, 'Europe/Warsaw', now)).toBe(false);
  });

  it('London DST transition: expiresAt = March 28, now = March 28 21:30 UTC (= 22:30 BST start day) → NOT expired', () => {
    // BST starts last Sunday of March; in 2026 = March 29, but we use March 28 → 29 boundary
    const now = new Date('2026-03-28T21:30:00.000Z');
    const expiresAt = new Date('2026-03-28T00:00:00.000Z');
    expect(isExpired(expiresAt, 'Europe/London', now)).toBe(false);
  });
});

describe('isExpired — US negative-offset @db.Date calendar date', () => {
  it('America/New_York: expiresAt = today (@db.Date UTC midnight), now = afternoon local → NOT expired', () => {
    const expiresAt = new Date('2026-07-10T00:00:00.000Z');
    const now = new Date('2026-07-10T22:00:00.000Z');
    expect(isExpired(expiresAt, 'America/New_York', now)).toBe(false);
  });

  it('America/New_York: expiresAt = today, now = next calendar day in TZ → expired', () => {
    const expiresAt = new Date('2026-07-10T00:00:00.000Z');
    const now = new Date('2026-07-11T12:00:00.000Z');
    expect(isExpired(expiresAt, 'America/New_York', now)).toBe(true);
  });

  it('America/Los_Angeles: expiresAt = today, now = morning local → NOT expired', () => {
    const expiresAt = new Date('2026-01-15T00:00:00.000Z');
    const now = new Date('2026-01-15T20:00:00.000Z');
    expect(isExpired(expiresAt, 'America/Los_Angeles', now)).toBe(false);
  });
});
