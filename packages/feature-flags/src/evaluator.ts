import { createLogger } from '@contractor-ops/logger';
import type { FlagClient, FlagEvalUnleashContext } from './client.js';
import { getFlagClient } from './client.js';
import type { FlagKey } from './registry.js';
import { FLAGS } from './registry.js';
import type { EvalContext, FlagDefinition } from './schemas.js';

const log = createLogger({ service: 'feature-flags' });

// ---------------------------------------------------------------------------
// Phase 64 D-10 — app-side override: even when Unleash returns true for
// 'module.classification-engine', the app refuses to enable classification
// if any disclaimer is still PENDING in the signoff registry.
//
// Implemented as a callback registered at app boot to avoid adding a
// compile-time dependency from packages/feature-flags → packages/validators
// (which would risk a circular dep). The callback is null by default —
// safe fallback is no override (flag resolves to Unleash value).
// ---------------------------------------------------------------------------

let ClassificationDisclaimerGate: (() => boolean) | null = null;

/**
 * Register a disclaimer-gate callback. Called once at app startup from
 * apps/web/src/lib/feature-flags-init.ts. Returns true when all classification
 * disclaimers are APPROVED, preventing operator enabling before sign-off.
 *
 * @param fn - Returns true when all classification disclaimers are APPROVED.
 */
export function registerClassificationDisclaimerGate(fn: () => boolean): void {
  ClassificationDisclaimerGate = fn;
}

export type EvalReason = 'jurisdiction-mismatch' | 'unleash' | 'client-error';

export interface EvalResult {
  enabled: boolean;
  reason: EvalReason;
}

/**
 * Maps our evaluation context onto the Unleash SDK context shape.
 *
 * We use the org id as `userId` so Unleash's built-in stickiness strategies
 * (gradual rollout, UserIDs) treat an organization as the targetable unit.
 * Per-user targeting remains possible via the `properties.userId` custom field.
 */
function toUnleashContext(ctx: EvalContext): FlagEvalUnleashContext {
  return {
    userId: ctx.organizationId,
    properties: {
      organizationId: ctx.organizationId,
      region: ctx.region,
      countryCode: ctx.countryCode ?? '',
      tier: ctx.tier ?? '',
      role: ctx.role ?? '',
      userId: ctx.userId ?? '',
      authMode: ctx.authMode ?? '',
    },
  };
}

/**
 * Pure evaluator: given a flag definition, an eval context, and a client,
 * returns the resolved flag state. The jurisdiction constraint short-circuits
 * BEFORE the client call — this is the structural compliance invariant that
 * cannot be bypassed from Unleash UI or data.
 *
 * Exported primarily for testing. Application code should use {@link evaluate}.
 */
export function evaluateAgainst(
  def: FlagDefinition,
  ctx: EvalContext,
  client: FlagClient,
): EvalResult {
  if (def.jurisdiction !== 'ANY' && def.jurisdiction !== ctx.region) {
    return { enabled: false, reason: 'jurisdiction-mismatch' };
  }
  // Defense in depth: Unleash SDK is documented to never throw on isEnabled
  // (it catches strategy errors internally), but a defective custom strategy
  // or a patched SDK could still throw. Catch here so a single broken flag
  // cannot 500 an entire request.
  try {
    const enabled = client.isEnabled(def.key, toUnleashContext(ctx), def.default);
    return { enabled, reason: 'unleash' };
  } catch (err) {
    log.error(
      { err, flagKey: def.key },
      'flag client threw during isEnabled; falling back to code default',
    );
    return { enabled: def.default, reason: 'client-error' };
  }
}

/**
 * Resolves a flag for the given evaluation context. Picks the regional Unleash
 * client by `ctx.region`. Never throws — a missing or failing Unleash falls
 * through to the code-declared `default`.
 */
export function evaluate(key: FlagKey, ctx: EvalContext): EvalResult {
  const def = FLAGS[key];
  const client = getFlagClient(ctx.region);
  const base = evaluateAgainst(def, ctx, client);

  // Phase 64 D-10 — classification disclaimer gate override
  if (
    key === 'module.classification-engine' &&
    base.enabled &&
    ClassificationDisclaimerGate !== null
  ) {
    const allApproved = ClassificationDisclaimerGate();
    if (!allApproved) {
      log.warn(
        { organizationId: ctx.organizationId, flag: key },
        'classification-engine flag overridden to false: disclaimer(s) PENDING',
      );
      return { enabled: false, reason: base.reason };
    }
  }

  return base;
}
