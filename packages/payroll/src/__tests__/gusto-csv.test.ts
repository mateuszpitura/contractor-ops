import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { GustoCsvProfile } from '../profiles/gusto-csv/index.js';
import { usFeed } from './fixtures/feeds.js';

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const golden = readFileSync(new URL('./fixtures/gusto.golden.csv', import.meta.url), 'utf8');

describe('GustoCsvProfile', () => {
  it('registers under profileId "gusto-csv" gated by payroll.gusto', () => {
    expect(GustoCsvProfile.profileId).toBe('gusto-csv');
    expect(GustoCsvProfile.country).toBe('US');
    expect(GustoCsvProfile.flagKey).toBe('payroll.gusto');
  });

  it('generate(feed) == golden Gusto import CSV with a UTF-8 BOM', async () => {
    const result = await GustoCsvProfile.generate(usFeed);
    expect(result.ext).toBe('csv');
    expect(result.buffer.subarray(0, 3)).toEqual(BOM);
    expect(result.buffer.subarray(3).toString('utf8')).toBe(golden);
  });
});
