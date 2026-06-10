/**
 * en-US locale registration + fallback chain.
 *
 * en-US is a thin-override locale: it is selectable, carries only divergent
 * keys in `messages/en-US.json`, and inherits every unchanged key from `en`
 * via the i18next `fallbackLng` chain (en-US → en → pl). These pins guard the
 * registration surface (SUPPORTED_LOCALES / localeMeta / loader / pickBestLocale)
 * and the `Intl` en-US date/currency formatting the US copy relies on.
 */

import { describe, expect, it } from 'vitest';

import {
  isSupportedLocale,
  loadLocaleMessages,
  localeMeta,
  pickBestLocale,
  SUPPORTED_LOCALES,
} from '../messages.js';

describe('en-US locale registration', () => {
  it('includes en-US in SUPPORTED_LOCALES', () => {
    expect((SUPPORTED_LOCALES as readonly string[]).includes('en-US')).toBe(true);
  });

  it('treats en-US as a supported locale', () => {
    expect(isSupportedLocale('en-US')).toBe(true);
  });

  it('exposes an ltr localeMeta entry labelled "English (US)"', () => {
    const meta = localeMeta['en-US'];
    expect(meta).toBeDefined();
    expect(meta.dir).toBe('ltr');
    expect(meta.nativeName).toBe('English (US)');
    expect(meta.englishName).toBe('English (US)');
  });

  it('does not regress the ar RTL direction', () => {
    expect(localeMeta.ar.dir).toBe('rtl');
  });

  it('loads the en-US thin-override bundle without throwing', async () => {
    const bundle = await loadLocaleMessages('en-US');
    expect(bundle).toBeTypeOf('object');
  });
});

describe('pickBestLocale exact en-US match', () => {
  it('resolves an exact en-US preference to en-US (not normalised to en)', () => {
    expect(pickBestLocale(['en-US'])).toBe('en-US');
  });

  it('still normalises other region subtags (en-GB → en)', () => {
    expect(pickBestLocale(['en-GB'])).toBe('en');
  });

  it('prefers an exact en-US match over a later plain en', () => {
    expect(pickBestLocale(['en-US', 'en'])).toBe('en-US');
  });
});

describe('Intl en-US formatting', () => {
  it('formats dates in MM/DD/YYYY order', () => {
    const formatted = new Intl.DateTimeFormat('en-US').format(new Date(Date.UTC(2026, 2, 4)));
    // March 4, 2026 → 3/4/2026 (month-first), never 4/3 (day-first).
    expect(formatted).toBe('3/4/2026');
  });

  it('renders USD currency with a leading $ sign', () => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(1234.5);
    expect(formatted).toBe('$1,234.50');
  });
});
