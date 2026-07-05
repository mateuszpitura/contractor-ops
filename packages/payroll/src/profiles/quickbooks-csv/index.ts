import { registerProfile } from '../../registry.js';
import type { PayrollFeed } from '../../types/feed.js';
import type { PayrollExportProfile, PayrollExportResult } from '../../types/profile.js';
import { generateQuickbooksCsv } from './generator.js';

// The CSV fallback the native QuickBooks bridge profile delegates to when
// payroll.quickbooks is dark or the org is not connected.
export const QuickbooksCsvProfile: PayrollExportProfile = {
  profileId: 'quickbooks-csv',
  country: 'US',
  displayName: 'QuickBooks Payroll (CSV import) (US)',
  flagKey: 'payroll.quickbooks',
  async generate(feed: PayrollFeed): Promise<PayrollExportResult> {
    return { buffer: await generateQuickbooksCsv(feed), ext: 'csv', mime: 'text/csv' };
  },
};

export function registerQuickbooksCsvProfile(): void {
  registerProfile(QuickbooksCsvProfile);
}
