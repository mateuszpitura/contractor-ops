import { registerProfile } from '../../registry.js';
import type { PayrollFeed } from '../../types/feed.js';
import type { PayrollExportProfile, PayrollExportResult } from '../../types/profile.js';
import { generateEnovaCsv } from './generator.js';

export const EnovaProfile: PayrollExportProfile = {
  profileId: 'enova',
  country: 'PL',
  displayName: 'enova365 Kadry i Płace (PL)',
  flagKey: 'payroll.enova',
  async generate(feed: PayrollFeed): Promise<PayrollExportResult> {
    return { buffer: await generateEnovaCsv(feed), ext: 'csv', mime: 'text/csv' };
  },
};

export function registerEnovaProfile(): void {
  registerProfile(EnovaProfile);
}
