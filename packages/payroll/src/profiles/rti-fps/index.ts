import { registerProfile } from '../../registry.js';
import type { PayrollFeed } from '../../types/feed.js';
import type { PayrollExportProfile, PayrollExportResult } from '../../types/profile.js';
import { RTI_FLAG_KEY } from '../rti-shared/constants.js';
import { validateRtiXml } from '../rti-shared/xsd-validate.js';
import { generateRtiFps } from './generator.js';

// Export-only: the FPS XML is importable into Sage / BrightPay / Moneysoft.
// Direct HMRC submission over the Government Gateway is deferred to v7.5.
export const RtiFpsProfile: PayrollExportProfile = {
  profileId: 'rti-fps',
  country: 'GB',
  displayName: 'HMRC RTI Full Payment Submission (UK)',
  flagKey: RTI_FLAG_KEY,
  async generate(feed: PayrollFeed): Promise<PayrollExportResult> {
    const buffer = generateRtiFps(feed);
    const validation = validateRtiXml(buffer.toString('utf8'));
    const warnings = validation.errors?.length ? validation.errors : undefined;
    return { buffer, ext: 'xml', mime: 'application/xml', warnings };
  },
};

export function registerRtiFpsProfile(): void {
  registerProfile(RtiFpsProfile);
}
