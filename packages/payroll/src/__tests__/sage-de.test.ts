import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { SageDeProfile } from '../profiles/sage-de/index.js';
import { deFeed } from './fixtures/feeds.js';

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const golden = readFileSync(new URL('./fixtures/sage-de.golden.csv', import.meta.url), 'utf8');

describe('SageDeProfile', () => {
  it('registers under profileId "sage-de" gated by its own payroll.sage-de flag', () => {
    expect(SageDeProfile.profileId).toBe('sage-de');
    expect(SageDeProfile.country).toBe('DE');
    expect(SageDeProfile.flagKey).toBe('payroll.sage-de');
  });

  it('generate(feed) == golden Sage DE Personalwirtschaft CSV with a UTF-8 BOM', async () => {
    const result = await SageDeProfile.generate(deFeed);
    expect(result.ext).toBe('csv');
    expect(result.buffer.subarray(0, 3)).toEqual(BOM);
    expect(result.buffer.subarray(3).toString('utf8')).toBe(golden);
  });
});
