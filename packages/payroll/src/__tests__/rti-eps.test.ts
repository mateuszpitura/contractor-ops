import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { RtiEpsProfile } from '../profiles/rti-eps/index.js';
import { gbFeed } from './fixtures/feeds.js';

const golden = readFileSync(new URL('./fixtures/rti-eps.golden.xml', import.meta.url), 'utf8');

describe('RtiEpsProfile', () => {
  it('registers under profileId "rti-eps" gated by the payroll.sage-uk family flag', () => {
    expect(RtiEpsProfile.profileId).toBe('rti-eps');
    expect(RtiEpsProfile.country).toBe('GB');
    expect(RtiEpsProfile.flagKey).toBe('payroll.sage-uk');
  });

  it('generate(feed) == golden RTI EmployerPaymentSummary XML', async () => {
    const result = await RtiEpsProfile.generate(gbFeed);
    expect(result.ext).toBe('xml');
    const body = result.buffer.toString('utf8');
    expect(body).toContain('EmployerPaymentSummary');
    expect(body).toBe(golden);
  });
});
