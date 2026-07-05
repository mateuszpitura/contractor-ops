import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { DatevProfile } from '../profiles/datev/index.js';
import { deFeed } from './fixtures/feeds.js';

const golden = readFileSync(new URL('./fixtures/datev.golden.txt', import.meta.url), 'latin1');
const DATEV_RECORD_LENGTH = 121;

describe('DatevProfile', () => {
  it('registers under profileId "datev" gated by payroll.datev', () => {
    expect(DatevProfile.profileId).toBe('datev');
    expect(DatevProfile.country).toBe('DE');
    expect(DatevProfile.flagKey).toBe('payroll.datev');
  });

  it('generate(feed) == golden DATEV Lohn ASCII with a fixed record length', async () => {
    const result = await DatevProfile.generate(deFeed);
    expect(result.ext).toBe('txt');
    const body = result.buffer.toString('latin1');
    expect(body).toBe(golden);
    // header line + one fixed-width detail record per employee, each exactly 121 chars
    const detailRecords = body.split('\n').filter(Boolean).slice(1);
    expect(detailRecords).toHaveLength(deFeed.employees.length);
    for (const rec of detailRecords) {
      expect(rec.length).toBe(DATEV_RECORD_LENGTH);
    }
  });
});
