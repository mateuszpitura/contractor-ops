// Per-org dark gate for the public REST API surface.
//
// The whole public API ships dark behind `module.public-api`. The boot-time
// signoff gate (index.ts) is a registry check; THIS is the per-request,
// per-tenant enforcement: after the API key resolves the caller's org/region,
// re-evaluate the flag and refuse before any procedure body runs.
//
// Uses NOT_FOUND (not FORBIDDEN) so a tenant without the module cannot even
// confirm the API exists — the entire surface (reads + the dark writes) is
// invisible until an org is granted the flag in Phase 99.

import { evaluate } from '@contractor-ops/feature-flags';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { PUBLIC_API_DISABLED } from '../errors';

const log = createLogger({ service: 'public-api-flag-guard' });

/**
 * Assert `module.public-api` is enabled for the given org/region; throws
 * NOT_FOUND (dark) otherwise. Mirrors `assertWorkforceEnabled` but hides
 * existence instead of returning FORBIDDEN.
 */
export function assertPublicApiEnabled(organizationId: string, region: string): void {
  // The flag is jurisdiction 'ANY'; the Unleash client is still picked by
  // region, so coerce to a region the regional client map recognises.
  const evalRegion = region === 'ME' ? ('ME' as const) : ('EU' as const);

  const result = evaluate('module.public-api', { organizationId, region: evalRegion });

  if (!result.enabled) {
    log.warn(
      { organizationId, reason: result.reason, flag: 'module.public-api' },
      'Public API request blocked: module disabled for org',
    );
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: PUBLIC_API_DISABLED,
      cause: { flag: 'module.public-api', reason: result.reason },
    });
  }
}
