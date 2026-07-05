import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { RtiFpsProfile } from '../profiles/rti-fps/index.js';
import { validateRtiXml } from '../profiles/rti-shared/xsd-validate.js';
import { gbFeed } from './fixtures/feeds.js';

const golden = readFileSync(new URL('./fixtures/rti-fps.golden.xml', import.meta.url), 'utf8');

describe('RtiFpsProfile', () => {
  it('registers under profileId "rti-fps" gated by the payroll.sage-uk family flag', () => {
    expect(RtiFpsProfile.profileId).toBe('rti-fps');
    expect(RtiFpsProfile.country).toBe('GB');
    expect(RtiFpsProfile.flagKey).toBe('payroll.sage-uk');
  });

  it('generate(feed) == golden RTI FullPaymentSubmission XML', async () => {
    const result = await RtiFpsProfile.generate(gbFeed);
    expect(result.ext).toBe('xml');
    const body = result.buffer.toString('utf8');
    expect(body).toContain('FullPaymentSubmission');
    expect(body).toBe(golden);
  });

  it('the XSD validate seam is non-throwing when the offline HMRC bundle is absent', () => {
    const result = validateRtiXml(golden);
    expect(result.bundlePresent).toBe(false);
    expect(result.ok).toBe(true);
  });
});
