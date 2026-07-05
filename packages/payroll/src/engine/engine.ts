// ---------------------------------------------------------------------------
// Payroll Export Engine
// ---------------------------------------------------------------------------
//
// Orchestrates per-market payroll export profiles. The engine delegates all
// target-specific logic to registered profiles and never contains country
// code itself (clone of the e-invoice engine).

import { getProfile, listProfiles } from '../registry.js';
import type { PayrollFeed } from '../types/feed.js';
import type { PayrollExportResult } from '../types/profile.js';

/** A projection of a registered target for a "pick a target" UI/API. */
export interface PayrollTargetSummary {
  profileId: string;
  country: string;
  displayName: string;
  flagKey: string;
}

export class PayrollExportEngine {
  /** Generate a target-specific export file from a canonical PayrollFeed. */
  async generate(
    profileId: string,
    feed: PayrollFeed,
    opts?: unknown,
  ): Promise<PayrollExportResult> {
    const profile = getProfile(profileId);
    return profile.generate(feed, opts);
  }

  /** List every registered target (id / country / displayName / flagKey). */
  listTargets(): PayrollTargetSummary[] {
    return listProfiles().map(p => ({
      profileId: p.profileId,
      country: p.country,
      displayName: p.displayName,
      flagKey: p.flagKey,
    }));
  }
}
