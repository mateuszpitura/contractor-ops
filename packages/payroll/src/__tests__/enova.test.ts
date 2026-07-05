import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { EnovaProfile } from '../profiles/enova/index.js';
import { plFeed } from './fixtures/feeds.js';

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const golden = readFileSync(new URL('./fixtures/enova.golden.csv', import.meta.url), 'utf8');

describe('EnovaProfile', () => {
  it('registers under profileId "enova" gated by payroll.enova', () => {
    expect(EnovaProfile.profileId).toBe('enova');
    expect(EnovaProfile.country).toBe('PL');
    expect(EnovaProfile.flagKey).toBe('payroll.enova');
  });

  it('generate(feed) == golden enova365 CSV with a UTF-8 BOM', async () => {
    const result = await EnovaProfile.generate(plFeed);
    expect(result.ext).toBe('csv');
    expect(result.buffer.subarray(0, 3)).toEqual(BOM);
    expect(result.buffer.subarray(3).toString('utf8')).toBe(golden);
  });
});
