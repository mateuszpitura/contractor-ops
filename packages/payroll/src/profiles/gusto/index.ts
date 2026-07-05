import { registerProfile } from '../../registry.js';
import type { PayrollFeed } from '../../types/feed.js';
import type { PayrollExportProfile, PayrollExportResult } from '../../types/profile.js';
import type { GustoBridgeContext } from './bridge.js';
import { gustoBridgeGenerate } from './bridge.js';

export type { GustoBridgeContext } from './bridge.js';

// Native Gusto target. Its generate() resolves via the flag-gated bridge: native
// push when payroll.gusto is APPROVED + connected (deps injected by packages/api
// through opts), else the Gusto CSV fallback.
export const GustoProfile: PayrollExportProfile = {
  profileId: 'gusto',
  country: 'US',
  displayName: 'Gusto Payroll (US)',
  flagKey: 'payroll.gusto',
  async generate(feed: PayrollFeed, opts?: unknown): Promise<PayrollExportResult> {
    return gustoBridgeGenerate(feed, (opts ?? {}) as GustoBridgeContext);
  },
};

export function registerGustoProfile(): void {
  registerProfile(GustoProfile);
}
