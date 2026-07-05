import { registerProfile } from '../../registry.js';
import type { PayrollFeed } from '../../types/feed.js';
import type { PayrollExportProfile, PayrollExportResult } from '../../types/profile.js';
import { generateSageDeCsv } from './generator.js';

export const SageDeProfile: PayrollExportProfile = {
  profileId: 'sage-de',
  country: 'DE',
  displayName: 'Sage HR / Personalwirtschaft (DE)',
  flagKey: 'payroll.sage-de',
  async generate(feed: PayrollFeed): Promise<PayrollExportResult> {
    return { buffer: await generateSageDeCsv(feed), ext: 'csv', mime: 'text/csv' };
  },
};

export function registerSageDeProfile(): void {
  registerProfile(SageDeProfile);
}
