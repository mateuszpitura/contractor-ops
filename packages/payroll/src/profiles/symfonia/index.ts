import { registerProfile } from '../../registry.js';
import type { PayrollFeed } from '../../types/feed.js';
import type { PayrollExportProfile, PayrollExportResult } from '../../types/profile.js';
import { SYMFONIA_FLAG_KEY, SYMFONIA_PROFILE_ID } from './constants.js';
import { generateSymfoniaCsv, generateSymfoniaXml } from './generator.js';

export interface SymfoniaOptions {
  format?: 'csv' | 'xml';
}

export const SymfoniaProfile: PayrollExportProfile = {
  profileId: SYMFONIA_PROFILE_ID,
  country: 'PL',
  displayName: 'Symfonia Kadry i Płace (PL)',
  flagKey: SYMFONIA_FLAG_KEY,
  async generate(feed: PayrollFeed, opts?: unknown): Promise<PayrollExportResult> {
    const format = (opts as SymfoniaOptions | undefined)?.format ?? 'csv';
    if (format === 'xml') {
      return { buffer: generateSymfoniaXml(feed), ext: 'xml', mime: 'application/xml' };
    }
    return { buffer: await generateSymfoniaCsv(feed), ext: 'csv', mime: 'text/csv' };
  },
};

export function registerSymfoniaProfile(): void {
  registerProfile(SymfoniaProfile);
}
