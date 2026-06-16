// Defense-in-depth flag guard for the US tax-form surface.
//
// The US cross-border surface ships dark behind `module.us-expansion`. Two
// enforcement layers protect it:
//   1. Conditional root.ts registration — the staff US tax procedures are absent
//      from appRouter when the global flag is OFF.
//   2. This per-request guard — re-evaluates the flag for the caller's org /
//      region at request time and throws before any business logic runs.
//
// The portal procedures cannot be conditionally spread (the portal router is a
// flat merge), so this guard is the load-bearing gate on the portal side and a
// belt-and-braces gate on the staff side.
//
// Error code: FORBIDDEN with message US_EXPANSION_DISABLED so clients can
// distinguish a flag-off response from a generic auth failure.

import { evaluate } from '@contractor-ops/feature-flags';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { US_EXPANSION_DISABLED } from '../errors';

const log = createLogger({ service: 'us-expansion-flag-guard' });

/**
 * Assert the US-expansion flag is enabled for the given org/region; throws
 * FORBIDDEN otherwise. Shared by the staff and portal US tax procedures so the
 * gate is identical regardless of caller surface.
 */
export function assertUsExpansionEnabled(organizationId: string, region: string): void {
  // The flag is jurisdiction 'ANY'; the Unleash client is still picked by
  // region, so coerce to a region the regional client map recognises.
  const evalRegion = region === 'ME' ? ('ME' as const) : ('EU' as const);

  const result = evaluate('module.us-expansion', { organizationId, region: evalRegion });

  if (!result.enabled) {
    log.warn(
      { organizationId, reason: result.reason, flag: 'module.us-expansion' },
      'US tax-form procedure blocked: flag disabled',
    );
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: US_EXPANSION_DISABLED,
      cause: { flag: 'module.us-expansion', reason: result.reason },
    });
  }
}

/**
 * Module-level evaluation mirroring root.ts `CLASSIFICATION_ENABLED`: decides
 * whether the staff US tax procedures are spread into appRouter at boot. A QA
 * walk org (QA_DEFAULT_ORG_ID) force-registers them so the seeded org can
 * exercise the gated surface; production never sets QA_DEFAULT_ORG_ID.
 */
export function isUsExpansionRegistered(): boolean {
  const base = evaluate('module.us-expansion', { organizationId: 'ROOT', region: 'EU' });
  return base.enabled || Boolean(process.env.QA_DEFAULT_ORG_ID);
}
