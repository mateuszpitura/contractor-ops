import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GustoProfile } from '../profiles/gusto/index.js';
import type { PayrollExportResult } from '../types/profile.js';
import { usFeed } from './fixtures/feeds.js';

const gustoGolden = readFileSync(new URL('./fixtures/gusto.golden.csv', import.meta.url), 'utf8');

describe('GustoProfile (native bridge)', () => {
  it('registers under profileId "gusto" gated by payroll.gusto', () => {
    expect(GustoProfile.profileId).toBe('gusto');
    expect(GustoProfile.country).toBe('US');
    expect(GustoProfile.flagKey).toBe('payroll.gusto');
  });

  it('falls back to the Gusto CSV export when the flag is dark (no native push)', async () => {
    const result = await GustoProfile.generate(usFeed, {
      evaluateFlag: () => false,
      pushNative: async () => {
        throw new Error('must not push when dark');
      },
    });
    expect(result.ext).toBe('csv');
    expect(result.buffer.subarray(3).toString('utf8')).toBe(gustoGolden);
  });

  it('falls back to CSV when enabled but the org is not connected', async () => {
    const result = await GustoProfile.generate(usFeed, {
      evaluateFlag: () => true,
      resolveConnection: async () => null,
      pushNative: async () => {
        throw new Error('must not push without a connection');
      },
    });
    expect(result.ext).toBe('csv');
  });

  it('pushes native when payroll.gusto is enabled and the org is connected', async () => {
    const native: PayrollExportResult = {
      buffer: Buffer.from('{"ok":true}'),
      ext: 'txt',
      mime: 'application/json',
      warnings: ['pushed to Gusto'],
    };
    const result = await GustoProfile.generate(usFeed, {
      evaluateFlag: () => true,
      resolveConnection: async () => ({ id: 'conn-1' }),
      pushNative: async () => native,
    });
    expect(result).toBe(native);
  });
});
