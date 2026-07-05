import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { QuickbooksCsvProfile } from '../profiles/quickbooks-csv/index.js';
import { usFeed } from './fixtures/feeds.js';

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const golden = readFileSync(new URL('./fixtures/quickbooks.golden.csv', import.meta.url), 'utf8');

describe('QuickbooksCsvProfile', () => {
  it('registers under profileId "quickbooks-csv" gated by payroll.quickbooks', () => {
    expect(QuickbooksCsvProfile.profileId).toBe('quickbooks-csv');
    expect(QuickbooksCsvProfile.country).toBe('US');
    expect(QuickbooksCsvProfile.flagKey).toBe('payroll.quickbooks');
  });

  it('generate(feed) == golden QuickBooks Payroll import CSV with a UTF-8 BOM', async () => {
    const result = await QuickbooksCsvProfile.generate(usFeed);
    expect(result.ext).toBe('csv');
    expect(result.buffer.subarray(0, 3)).toEqual(BOM);
    expect(result.buffer.subarray(3).toString('utf8')).toBe(golden);
  });
});
