import type { ProviderHealthStatus } from '../types/health.js';
import type { GetHealthStatusOptions } from './base-adapter.js';
import { BaseAdapter } from './base-adapter.js';

// ---------------------------------------------------------------------------
// Clockify Regional Base URLs (Pitfall 3 from RESEARCH.md)
// ---------------------------------------------------------------------------

/**
 * Clockify uses regional base URLs. Users must select their region
 * during connection setup — API keys are region-specific.
 */
export const CLOCKIFY_REGIONS = {
  global: 'https://api.clockify.me/api/v1',
  eu: 'https://euc1.clockify.me/api/v1',
  us: 'https://use2.clockify.me/api/v1',
  uk: 'https://euw2.clockify.me/api/v1',
  au: 'https://apse2.clockify.me/api/v1',
} as const satisfies Record<string, string>;

export type ClockifyRegion = keyof typeof CLOCKIFY_REGIONS;

// ---------------------------------------------------------------------------
// Clockify Adapter
// ---------------------------------------------------------------------------

/**
 * Integration adapter for Clockify time tracking.
 *
 * Clockify uses API key authentication (not OAuth). The API key is stored
 * as an encrypted credential via the standard credential service. Connection
 * config stores the workspaceId, userId, and region for API calls.
 *
 * Auth: X-Api-Key header with the user's API key.
 *
 * Env vars required:
 * - CLOCKIFY_ENCRYPTION_KEY — for credential encryption at rest
 */
export class ClockifyAdapter extends BaseAdapter {
  readonly slug = 'clockify';
  readonly displayName = 'Clockify';
  readonly supportsOAuth = false;
  readonly supportsWebhooks = false;

  /**
   * API keys do not expire — defer to the shared default but disable the
   * token-expiry derivation step.
   */
  override async getHealthStatus(
    connectionId: string,
    options?: GetHealthStatusOptions,
  ): Promise<ProviderHealthStatus> {
    return super.getHealthStatus(connectionId, {
      includeTokenExpiry: false,
      ...options,
    });
  }
}
