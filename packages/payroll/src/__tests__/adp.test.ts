import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { AdpProfile } from '../profiles/adp/index.js';
import { usFeed } from './fixtures/feeds.js';

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const golden = readFileSync(new URL('./fixtures/adp.golden.csv', import.meta.url), 'utf8');

describe('AdpProfile', () => {
  it('registers under profileId "adp" gated by payroll.adp (native push deferred to v7.1)', () => {
    expect(AdpProfile.profileId).toBe('adp');
    expect(AdpProfile.country).toBe('US');
    expect(AdpProfile.flagKey).toBe('payroll.adp');
  });

  it('generate(feed) == golden ADP import CSV with a UTF-8 BOM and masked SSN', async () => {
    const result = await AdpProfile.generate(usFeed);
    expect(result.ext).toBe('csv');
    expect(result.buffer.subarray(0, 3)).toEqual(BOM);
    const body = result.buffer.subarray(3).toString('utf8');
    expect(body).toBe(golden);
    expect(body).not.toContain('123456789');
  });
});
