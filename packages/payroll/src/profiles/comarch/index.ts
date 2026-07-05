import { registerProfile } from '../../registry.js';
import type { PayrollFeed } from '../../types/feed.js';
import type { PayrollExportProfile, PayrollExportResult } from '../../types/profile.js';
import { generateComarchCsv } from './generator.js';

export const ComarchProfile: PayrollExportProfile = {
  profileId: 'comarch',
  country: 'PL',
  displayName: 'Comarch ERP Optima (PL)',
  flagKey: 'payroll.comarch',
  async generate(feed: PayrollFeed): Promise<PayrollExportResult> {
    return { buffer: await generateComarchCsv(feed), ext: 'csv', mime: 'text/csv' };
  },
};

export function registerComarchProfile(): void {
  registerProfile(ComarchProfile);
}
