import { TZDate } from '@date-fns/tz';
import { format, startOfDay } from 'date-fns';
import type { CooldownDecision, CooldownInput } from './types.js';
import { COOLDOWN_DAYS } from './types.js';

/**
 * Single source-of-truth cooldown gate.
 *
 * Rule: deprovisioning is allowed when:
 * 1. assignment.status === 'ENDED'
 * 2. assignment.endedAt is non-null
 * 3. now() >= startOfDay(endedAt + 14 days) IN THE CONTRACTOR'S JURISDICTION TZ
 *
 * Hard rule: no admin override. If business needs deprovisioning sooner,
 * admin must edit assignment.endedAt to an earlier date (independently audited).
 *
 * PURE: no DB reads, no I/O, no global state. Callers:
 *   - tRPC getDeprovisioningEligibility query (UX disable + tooltip)
 *   - tRPC startDeprovisioningRun mutation (server-side authoritative gate)
 *   - Test fixtures (deterministic via the optional `now` parameter)
 */
export function canStartDeprovisioning(input: CooldownInput): CooldownDecision {
  if (input.status !== 'ENDED') {
    return { allowed: false, reason: 'Assignment is not ENDED' };
  }
  if (!input.endedAt) {
    return {
      allowed: false,
      reason: 'endedAt timestamp missing — set via assignment edit before deprovisioning',
    };
  }

  const now = input.now ?? new Date();

  // Boundary = startOfDay( endedAt + 14d ) in the jurisdiction TZ.
  // Mirrors the expiry boundary in packages/compliance-policy/src/expiry.ts.
  const endedAtPlus14 = new Date(input.endedAt.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const earliestDate = new Date(
    startOfDay(new TZDate(endedAtPlus14, input.jurisdictionTz)).getTime(),
  );

  if (now.getTime() < earliestDate.getTime()) {
    // Format in the jurisdiction TZ so east-of-UTC locales (Asia/Riyadh +03,
    // Asia/Dubai +04) get the correct calendar date — UTC ISO slice would
    // render the previous day for those TZs. Mirrors jurisdictionDate() in
    // compliance-policy/src/expiry.ts.
    const dateStr = format(new TZDate(earliestDate, input.jurisdictionTz), 'yyyy-MM-dd');
    return {
      allowed: false,
      earliestDate,
      reason: `14-day cooldown active — earliest deprovisioning date: ${dateStr}`,
    };
  }

  return { allowed: true, earliestDate };
}
