import { registerProfile } from '../../registry.js';
import type { PayrollFeed } from '../../types/feed.js';
import type { PayrollExportProfile, PayrollExportResult } from '../../types/profile.js';
import { DATEV_FLAG_KEY, DATEV_PROFILE_ID } from './constants.js';
import { generateDatevAscii } from './generator.js';

export type { DatevConnectConnection, DatevConnectResult } from './datevconnect-seam.js';
export { pushViaDatevConnect } from './datevconnect-seam.js';

export const DatevProfile: PayrollExportProfile = {
  profileId: DATEV_PROFILE_ID,
  country: 'DE',
  displayName: 'DATEV Lohn und Gehalt (DE)',
  flagKey: DATEV_FLAG_KEY,
  async generate(feed: PayrollFeed): Promise<PayrollExportResult> {
    return { buffer: generateDatevAscii(feed), ext: 'txt', mime: 'text/plain' };
  },
};

export function registerDatevProfile(): void {
  registerProfile(DatevProfile);
}
