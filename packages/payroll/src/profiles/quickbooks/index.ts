import { registerProfile } from '../../registry.js';
import type { PayrollFeed } from '../../types/feed.js';
import type { PayrollExportProfile, PayrollExportResult } from '../../types/profile.js';
import type { QuickBooksBridgeContext } from './bridge.js';
import { quickbooksBridgeGenerate } from './bridge.js';

export type { QuickBooksBridgeContext } from './bridge.js';

// Native QuickBooks target. Its generate() resolves via the flag-gated bridge:
// native push when payroll.quickbooks is APPROVED + connected (deps injected by
// packages/api through opts), else the QuickBooks CSV fallback.
export const QuickBooksProfile: PayrollExportProfile = {
  profileId: 'quickbooks',
  country: 'US',
  displayName: 'QuickBooks Payroll (US)',
  flagKey: 'payroll.quickbooks',
  async generate(feed: PayrollFeed, opts?: unknown): Promise<PayrollExportResult> {
    return quickbooksBridgeGenerate(feed, (opts ?? {}) as QuickBooksBridgeContext);
  },
};

export function registerQuickBooksProfile(): void {
  registerProfile(QuickBooksProfile);
}
