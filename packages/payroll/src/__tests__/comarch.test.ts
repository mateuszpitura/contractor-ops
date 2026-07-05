import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ComarchProfile } from '../profiles/comarch/index.js';
import { plFeed } from './fixtures/feeds.js';

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const golden = readFileSync(new URL('./fixtures/comarch.golden.csv', import.meta.url), 'utf8');

describe('ComarchProfile', () => {
  it('registers under profileId "comarch" gated by payroll.comarch', () => {
    expect(ComarchProfile.profileId).toBe('comarch');
    expect(ComarchProfile.country).toBe('PL');
    expect(ComarchProfile.flagKey).toBe('payroll.comarch');
  });

  it('generate(feed) == golden Comarch Optima CSV with a UTF-8 BOM', async () => {
    const result = await ComarchProfile.generate(plFeed);
    expect(result.ext).toBe('csv');
    expect(result.buffer.subarray(0, 3)).toEqual(BOM);
    expect(result.buffer.subarray(3).toString('utf8')).toBe(golden);
  });
});
