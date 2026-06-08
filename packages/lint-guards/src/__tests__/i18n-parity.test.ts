// Phase 70-01 · FOUND6-03 — failing test scaffold for the message-key parity
// guard. Plan 70-04 implements `runI18nParity` (loads en/de/pl/ar JSON,
// flattens key paths, asserts EN keys are a subset of every peer locale).
//
// Phase 84-02 · US-LOC-01 — fallback-aware peer mode. en-US is a thin-override
// locale that inherits every unchanged key from en via the i18next fallbackLng
// chain (en-US → en → pl). The parity gate must treat a key present in en as
// covered for en-US, so a deliberately-thin en-US.json passes — without relaxing
// the exact-parity semantics of the strict peers (de/pl/ar).

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { flattenLocaleKeys, runI18nParity } from '../i18n-parity/run-guard';

const FX = join(__dirname, '..', '__fixtures__', 'messages');
const FX_FALLBACK = join(__dirname, '..', '__fixtures__', 'messages-fallback');

describe('i18n-parity (FOUND6-03)', () => {
  it('reports keys in en.json missing from any of {de,pl,ar}.json', async () => {
    const offences = await runI18nParity({
      messagesDir: FX,
      base: 'en',
      peers: ['de', 'pl', 'ar'],
    });
    expect(offences).toHaveLength(1);
    expect(offences[0]?.locale).toBe('pl');
    expect(offences[0]?.missingKey).toBe('Greeting.world');
  });
});

describe('i18n-parity fallback-aware peer mode (US-LOC-01, 84-02)', () => {
  it('passes for en-US when a divergent override key is present in en-US (and en)', async () => {
    const fallbackBase = await flattenLocaleKeys(join(FX_FALLBACK, 'en.json'));
    const offences = await runI18nParity({
      messagesDir: FX_FALLBACK,
      base: 'en',
      peers: [],
      fallbackPeers: { 'en-US': fallbackBase },
    });
    // en-US.json holds only `Greeting.color`; everything else inherits from en.
    expect(offences.filter(o => o.locale === 'en-US')).toHaveLength(0);
  });

  it('passes for en-US when a key is present only in en (covered via fallback)', async () => {
    const fallbackBase = await flattenLocaleKeys(join(FX_FALLBACK, 'en.json'));
    const offences = await runI18nParity({
      messagesDir: FX_FALLBACK,
      base: 'en',
      peers: [],
      fallbackPeers: { 'en-US': fallbackBase },
    });
    // `Greeting.hello` / `Greeting.world` are absent from en-US.json yet covered
    // by the en fallback — so they must NOT surface as en-US offences.
    expect(offences.some(o => o.locale === 'en-US' && o.missingKey === 'Greeting.hello')).toBe(
      false,
    );
    expect(offences.some(o => o.locale === 'en-US' && o.missingKey === 'Greeting.world')).toBe(
      false,
    );
  });

  it('still fails for a strict peer (de) missing a base key — fallback mode does not relax strict peers', async () => {
    const fallbackBase = await flattenLocaleKeys(join(FX_FALLBACK, 'en.json'));
    const offences = await runI18nParity({
      messagesDir: FX_FALLBACK,
      base: 'en',
      peers: ['de', 'pl', 'ar'],
      fallbackPeers: { 'en-US': fallbackBase },
    });
    // de.json omits `Greeting.color`; pl/ar have it. en-US thin override passes.
    expect(offences).toHaveLength(1);
    expect(offences[0]?.locale).toBe('de');
    expect(offences[0]?.missingKey).toBe('Greeting.color');
  });

  it('flags a base key for en-US when it is missing from BOTH en-US and its fallbackBase (true gap)', async () => {
    // Simulate a fallbackBase that does NOT cover `Greeting.world` (e.g. en itself
    // regressed). Union semantics must then surface `Greeting.world` as an en-US gap.
    const partialFallback = new Set(['Greeting.hello', 'Greeting.color']);
    const offences = await runI18nParity({
      messagesDir: FX_FALLBACK,
      base: 'en',
      peers: [],
      fallbackPeers: { 'en-US': partialFallback },
    });
    const enUsGaps = offences.filter(o => o.locale === 'en-US');
    expect(enUsGaps).toHaveLength(1);
    expect(enUsGaps[0]?.missingKey).toBe('Greeting.world');
  });
});
