import { describe, expect, it } from 'vitest';
import { isExpired } from '../expiry.js';

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
});
