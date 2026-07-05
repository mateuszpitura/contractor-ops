import { registerProfile } from '../../registry.js';
import type { PayrollFeed } from '../../types/feed.js';
import type { PayrollExportProfile, PayrollExportResult } from '../../types/profile.js';
import { generateGustoCsv } from './generator.js';

// The CSV fallback the native Gusto bridge profile delegates to when
// payroll.gusto is dark or the org is not connected.
export const GustoCsvProfile: PayrollExportProfile = {
  profileId: 'gusto-csv',
  country: 'US',
  displayName: 'Gusto (CSV import) (US)',
  flagKey: 'payroll.gusto',
  async generate(feed: PayrollFeed): Promise<PayrollExportResult> {
    return { buffer: await generateGustoCsv(feed), ext: 'csv', mime: 'text/csv' };
  },
};

export function registerGustoCsvProfile(): void {
  registerProfile(GustoCsvProfile);
}
