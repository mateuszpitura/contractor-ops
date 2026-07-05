import { beforeEach, describe, expect, it } from 'vitest';

import { PayrollExportEngine } from '../engine/engine.js';
import { clearProfiles, registerProfile } from '../registry.js';
import type { PayrollFeed } from '../types/feed.js';
import type { PayrollExportProfile, PayrollExportResult } from '../types/profile.js';

const SENTINEL = Buffer.from('sentinel-output');

function createFakeProfile(id: string, result: PayrollExportResult): PayrollExportProfile {
  return {
    profileId: id,
    country: 'PL',
    displayName: `Fake (${id})`,
    flagKey: `payroll.${id}`,
    async generate(_feed: PayrollFeed): Promise<PayrollExportResult> {
      return result;
    },
  };
}

const feed: PayrollFeed = {
  organizationId: 'org-1',
  generatedAt: '2026-07-05T00:00:00.000Z',
  targetCountry: 'PL',
  employees: [],
};

describe('PayrollExportEngine', () => {
  beforeEach(() => {
    clearProfiles();
  });

  it('generate() resolves the profile by id and returns its result unchanged', async () => {
    const result: PayrollExportResult = { buffer: SENTINEL, ext: 'csv', mime: 'text/csv' };
    registerProfile(createFakeProfile('fake', result));

    const engine = new PayrollExportEngine();
    const out = await engine.generate('fake', feed);
    expect(out).toBe(result);
    expect(out.buffer.toString()).toBe('sentinel-output');
  });

  it('generate() throws fail-fast for an unknown profile id', async () => {
    const engine = new PayrollExportEngine();
    await expect(engine.generate('missing', feed)).rejects.toThrow(
      'Unknown payroll export profile: missing',
    );
  });

  it('listTargets() projects id / country / displayName / flagKey for every profile', () => {
    registerProfile(createFakeProfile('fake', { buffer: SENTINEL, ext: 'csv', mime: 'text/csv' }));
    const engine = new PayrollExportEngine();
    expect(engine.listTargets()).toEqual([
      { profileId: 'fake', country: 'PL', displayName: 'Fake (fake)', flagKey: 'payroll.fake' },
    ]);
  });
});
