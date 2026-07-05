import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { QuickBooksProfile } from '../profiles/quickbooks/index.js';
import type { PayrollExportResult } from '../types/profile.js';
import { usFeed } from './fixtures/feeds.js';

const qbGolden = readFileSync(new URL('./fixtures/quickbooks.golden.csv', import.meta.url), 'utf8');

describe('QuickBooksProfile (native bridge)', () => {
  it('registers under profileId "quickbooks" gated by payroll.quickbooks', () => {
    expect(QuickBooksProfile.profileId).toBe('quickbooks');
    expect(QuickBooksProfile.country).toBe('US');
    expect(QuickBooksProfile.flagKey).toBe('payroll.quickbooks');
  });

  it('falls back to the QuickBooks CSV export when the flag is dark (no native push)', async () => {
    const result = await QuickBooksProfile.generate(usFeed, {
      evaluateFlag: () => false,
      pushNative: async () => {
        throw new Error('must not push when dark');
      },
    });
    expect(result.ext).toBe('csv');
    expect(result.buffer.subarray(3).toString('utf8')).toBe(qbGolden);
  });

  it('falls back to CSV when enabled but the org is not connected', async () => {
    const result = await QuickBooksProfile.generate(usFeed, {
      evaluateFlag: () => true,
      resolveConnection: async () => null,
      pushNative: async () => {
        throw new Error('must not push without a connection');
      },
    });
    expect(result.ext).toBe('csv');
  });

  it('pushes native when payroll.quickbooks is enabled and the org is connected', async () => {
    const native: PayrollExportResult = {
      buffer: Buffer.from('{"ok":true}'),
      ext: 'txt',
      mime: 'application/json',
      warnings: ['pushed to QuickBooks'],
    };
    const result = await QuickBooksProfile.generate(usFeed, {
      evaluateFlag: () => true,
      resolveConnection: async () => ({ id: 'conn-1' }),
      pushNative: async () => native,
    });
    expect(result).toBe(native);
  });
});
