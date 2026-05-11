// Phase 70-01 · FOUND6-03 — failing test scaffold for the message-key parity
// guard. Plan 70-04 implements `runI18nParity` (loads en/de/pl/ar JSON,
// flattens key paths, asserts EN keys are a subset of every peer locale).

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runI18nParity } from '../i18n-parity/run-guard';

const FX = join(__dirname, '..', '__fixtures__', 'messages');

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
