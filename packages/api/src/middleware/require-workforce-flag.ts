// Defense-in-depth flag guard for the workforce / employee surface.
//
// The Theme B worker-model surface ships dark behind `module.workforce-employees`.
// Two enforcement layers protect it:
//   1. Conditional root.ts registration — the worker.* and employee.* procedures
//      are absent from appRouter when the global flag is OFF (METHOD_NOT_FOUND).
//   2. This per-request guard — re-evaluates the flag for the caller's org /
//      region at request time and throws before any business logic runs.
//
// Error code: FORBIDDEN with message WORKFORCE_DISABLED so clients can
// distinguish a flag-off response from a generic auth failure.

import { evaluate } from '@contractor-ops/feature-flags';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { WORKFORCE_DISABLED } from '../errors';

const log = createLogger({ service: 'workforce-flag-guard' });

/**
 * Assert the workforce flag is enabled for the given org/region; throws
 * FORBIDDEN otherwise. Shared by the worker and employee procedures so the
 * gate is identical regardless of caller surface.
 */
export function assertWorkforceEnabled(organizationId: string, region: string): void {
  // The flag is jurisdiction 'ANY'; the Unleash client is still picked by
  // region, so coerce to a region the regional client map recognises.
  const evalRegion = region === 'ME' ? ('ME' as const) : ('EU' as const);

  const result = evaluate('module.workforce-employees', { organizationId, region: evalRegion });

  if (!result.enabled) {
    log.warn(
      { organizationId, reason: result.reason, flag: 'module.workforce-employees' },
      'Workforce procedure blocked: flag disabled',
    );
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: WORKFORCE_DISABLED,
      cause: { flag: 'module.workforce-employees', reason: result.reason },
    });
  }
}

/**
 * Module-level evaluation mirroring the us-expansion gate: decides whether the
 * worker / employee procedures are spread into appRouter at boot. A QA walk org
 * (QA_DEFAULT_ORG_ID) force-registers them so the seeded org can exercise the
 * gated surface; production never sets QA_DEFAULT_ORG_ID.
 */
export function isWorkforceRegistered(): boolean {
  const base = evaluate('module.workforce-employees', { organizationId: 'ROOT', region: 'EU' });
  return base.enabled || Boolean(process.env.QA_DEFAULT_ORG_ID);
}
