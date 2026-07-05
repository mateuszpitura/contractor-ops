import { registerProfile } from '../../registry.js';
import type { PayrollFeed } from '../../types/feed.js';
import type { PayrollExportProfile, PayrollExportResult } from '../../types/profile.js';
import { RTI_FLAG_KEY } from '../rti-shared/constants.js';
import { validateRtiXml } from '../rti-shared/xsd-validate.js';
import { generateRtiEps } from './generator.js';

// Export-only employer-level summary (Sage / BrightPay / Moneysoft importable);
// direct HMRC submission is deferred to v7.5.
export const RtiEpsProfile: PayrollExportProfile = {
  profileId: 'rti-eps',
  country: 'GB',
  displayName: 'HMRC RTI Employer Payment Summary (UK)',
  flagKey: RTI_FLAG_KEY,
  async generate(feed: PayrollFeed): Promise<PayrollExportResult> {
    const buffer = generateRtiEps(feed);
    const validation = validateRtiXml(buffer.toString('utf8'));
    const warnings = validation.errors?.length ? validation.errors : undefined;
    return { buffer, ext: 'xml', mime: 'application/xml', warnings };
  },
};

export function registerRtiEpsProfile(): void {
  registerProfile(RtiEpsProfile);
}
