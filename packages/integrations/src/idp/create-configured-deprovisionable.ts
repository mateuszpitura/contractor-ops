// ---------------------------------------------------------------------------
// Factory — fresh Deprovisionable adapter instances with org tokens
// ---------------------------------------------------------------------------
//
// Registry singletons carry mutable token state (`withAccessToken` /
// `withOrgGridToken` mutate the instance). Concurrent saga steps must NOT
// share a registry instance — this factory creates a new adapter per call.

import type { BaseAdapter } from '../adapters/base-adapter.js';
import { GoogleWorkspaceAdapter } from '../adapters/google-workspace-adapter.js';
import { SlackAdapter } from '../adapters/slack-adapter.js';
import type { Deprovisionable } from '../types/deprovisionable.js';

export type TokenConfiguredDeprovisionProvider = 'GOOGLE_WORKSPACE' | 'SLACK';

/**
 * Creates a new Deprovisionable adapter configured with the org connection token.
 * Only GWS and SLACK are wired for token-based deprovision today.
 */
export function createConfiguredDeprovisionableAdapter(
  provider: TokenConfiguredDeprovisionProvider,
  accessToken: string,
): BaseAdapter & Deprovisionable {
  switch (provider) {
    case 'GOOGLE_WORKSPACE':
      return new GoogleWorkspaceAdapter().withAccessToken(accessToken);
    case 'SLACK':
      return new SlackAdapter().withOrgGridToken(accessToken);
    default: {
      const Exhaustive: never = provider;
      throw new Error(`Unknown deprovisioning provider: ${String(Exhaustive)}`);
    }
  }
}
