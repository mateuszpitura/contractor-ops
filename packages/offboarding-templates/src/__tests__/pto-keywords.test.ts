// Phase 74 Plan 02 — GREEN tests for PTO_KEYWORDS typed-const (D-08).

import { describe, expect, it } from 'vitest';
import { PTO_KEYWORDS } from '../pto-keywords.js';

describe('PTO_KEYWORDS — D-08 typed-const', () => {
  it('has en/de/pl keys; no ar', () => {
    const keys = Object.keys(PTO_KEYWORDS).sort();
    expect(keys).toEqual(['de', 'en', 'pl']);
    expect((PTO_KEYWORDS as Record<string, unknown>).ar).toBeUndefined();
  });

  it('en includes PTO, OOO, Out of Office, Vacation', () => {
    expect(PTO_KEYWORDS.en).toContain('PTO');
    expect(PTO_KEYWORDS.en).toContain('OOO');
    expect(PTO_KEYWORDS.en).toContain('Out of Office');
    expect(PTO_KEYWORDS.en).toContain('Vacation');
  });

  it('de includes Urlaub, Krank', () => {
    expect(PTO_KEYWORDS.de).toContain('Urlaub');
    expect(PTO_KEYWORDS.de).toContain('Krank');
  });

  it('pl includes Urlop, Wakacje', () => {
    expect(PTO_KEYWORDS.pl).toContain('Urlop');
    expect(PTO_KEYWORDS.pl).toContain('Wakacje');
  });
});
