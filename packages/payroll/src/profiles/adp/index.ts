import { registerProfile } from '../../registry.js';
import type { PayrollFeed } from '../../types/feed.js';
import type { PayrollExportProfile, PayrollExportResult } from '../../types/profile.js';
import { generateAdpCsv } from './generator.js';

// ADP CSV file export is the v7.0 ADP path. Native ADP API push (Marketplace
// partner approval + mTLS) is deferred to v7.1 behind the same payroll.adp flag.
export const AdpProfile: PayrollExportProfile = {
  profileId: 'adp',
  country: 'US',
  displayName: 'ADP Workforce Now (US)',
  flagKey: 'payroll.adp',
  async generate(feed: PayrollFeed): Promise<PayrollExportResult> {
    return { buffer: await generateAdpCsv(feed), ext: 'csv', mime: 'text/csv' };
  },
};

export function registerAdpProfile(): void {
  registerProfile(AdpProfile);
}
