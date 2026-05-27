/**
 * Pins for `pickBestLocale` — the helper resolves a browser-language
 * preference list to a supported locale, falling back to `DEFAULT_LOCALE`
 * when nothing matches. Used by the router-root loader to honour
 * `navigator.languages` on unlocalized visits.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, pickBestLocale } from '../messages.js';

describe('pickBestLocale', () => {
  it('returns the first preference when it is a supported locale', () => {
    expect(pickBestLocale(['de', 'en'])).toBe('de');
  });

  it('strips region subtags (`de-DE` → `de`)', () => {
    expect(pickBestLocale(['de-DE'])).toBe('de');
  });

  it('strips underscore-style subtags (`pl_PL` → `pl`)', () => {
    expect(pickBestLocale(['pl_PL'])).toBe('pl');
  });

  it('returns ar (RTL) when Arabic comes first in the preference list', () => {
    expect(pickBestLocale(['ar-SA', 'en-US'])).toBe('ar');
  });

  it('skips unsupported preferences until a supported one matches', () => {
    expect(pickBestLocale(['fr', 'es', 'en'])).toBe('en');
  });

  it('falls back to DEFAULT_LOCALE when every preference is unsupported', () => {
    expect(pickBestLocale(['fr', 'ja', 'pt'])).toBe(DEFAULT_LOCALE);
  });

  it('falls back to DEFAULT_LOCALE on an empty preference list', () => {
    expect(pickBestLocale([])).toBe(DEFAULT_LOCALE);
  });

  it('is case-insensitive on the language tag', () => {
    expect(pickBestLocale(['EN-GB'])).toBe('en');
  });
});
