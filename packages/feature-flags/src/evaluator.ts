import { createLogger } from '@contractor-ops/logger';
import type { FlagClient, FlagEvalUnleashContext } from './client';
import { getFlagClient, isStubClient } from './client';
import type { FlagKey } from './registry';
import { CLASSIFICATION_ENGINE_FLAG, FLAGS } from './registry';
import type { EvalContext, FlagDefinition } from './schemas';

const log = createLogger({ service: 'feature-flags' });

// ---------------------------------------------------------------------------
// App-side override: even when Unleash returns true for
// 'module.classification-engine', the app refuses to enable classification
// if any disclaimer is still PENDING in the signoff registry.
//
// Implemented as a callback registered at app boot to avoid adding a
// compile-time dependency from packages/feature-flags → packages/validators
// (which would risk a circular dep). The callback is null by default —
// safe fallback is no override (flag resolves to Unleash value).
//
// The callback is anchored on `globalThis` (mirroring the regional client map
// in client.ts) so a Next.js dev `require.cache` invalidation does NOT reset
// it to null — without this, hot-reload would silently re-open the gate
// between the moment the evaluator module re-evaluates and the moment
// `feature-flags-init` re-runs at the next request.
// ---------------------------------------------------------------------------

type GateRegistry = { __contractorOpsClassificationGate?: (() => boolean) | null };
const gateRegistry = globalThis as unknown as GateRegistry;

/**
 * Register a disclaimer-gate callback. Called once at app startup. Returns
 * true when all classification disclaimers are APPROVED, preventing
 * operator enabling before sign-off.
 *
 * @param fn - Returns true when all classification disclaimers are APPROVED.
 */
export function registerClassificationDisclaimerGate(fn: () => boolean): void {
  if (gateRegistry.__contractorOpsClassificationGate) {
    // Next.js dev HMR re-evaluates `feature-flags-init.ts` on every edit while
    // `evaluator.ts` (which owns this registry) is not part of the reload
    // boundary — so the gate appears "already registered" on subsequent
    // imports. That's benign: the latest registration wins, and in prod the
    // module is evaluated exactly once. Suppress the warn in development so
    // the noise doesn't drown out real signal; keep it in production where a
    // double-register would point at a real boot-path bug.
    if (process.env.NODE_ENV === 'development') {
      gateRegistry.__contractorOpsClassificationGate = fn;
      return;
    }
    log.warn(
      {},
      'registerClassificationDisclaimerGate called more than once — this usually means feature-flags-init was imported from multiple boot paths',
    );
  }
  gateRegistry.__contractorOpsClassificationGate = fn;
}

/**
 * Test helper: clear the registered gate. Not part of the public API.
 */
export function __resetClassificationDisclaimerGateForTesting(): void {
  gateRegistry.__contractorOpsClassificationGate = null;
}

export type EvalReason =
  | 'jurisdiction-mismatch'
  | 'unleash'
  | 'client-error'
  | 'disclaimer-pending'
  | 'kill-when-unknown';

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
  // Kill-switch outage semantics: when Unleash is unreachable (stub client)
  // and the flag is marked killWhenUnknown, treat the flag as off. Without
  // this, a kill-switch with `default: true` keeps the gated feature live
  // during an Unleash outage — defeating the entire point of the kill-switch.
  if (def.killWhenUnknown === true && isStubClient(client)) {
    return { enabled: false, reason: 'kill-when-unknown' };
  }
  // Defense in depth: Unleash SDK is documented to never throw on isEnabled
  // (it catches strategy errors internally), but a defective custom strategy
  // or a patched SDK could still throw. Catch here so a single broken flag
  // cannot 500 an entire request.
  try {
    const raw = client.isEnabled(def.key, toUnleashContext(ctx), def.default);
    // Coerce defensively. The SDK is JS at runtime; a defective custom
    // strategy could return undefined / null / a non-boolean. Mirror the
    // strict `=== true` check used on the bag's read side (flag-bag.ts).
    const enabled = raw === true;
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

  // QA walk override: force-enable dark-shipped flags for the seeded QA
  // org so the walk can exercise classification / einvoice routes without
  // touching Unleash UI or default state. Only honoured in development
  // when the request's organizationId matches QA_DEFAULT_ORG_ID — the env
  // var is read at server boot so changes require a dev-server restart
  // (Next.js does not hot-reload .env). Production never matches because
  // production never sets QA_DEFAULT_ORG_ID.
  if (process.env.NODE_ENV === 'development') {
    const qaOrgId = process.env.QA_DEFAULT_ORG_ID;
    if (qaOrgId && ctx.organizationId === qaOrgId) {
      const QA_FORCED_KEYS: readonly string[] = [
        'module.classification-engine',
        'einvoice.import-enabled',
        'module.us-expansion',
      ];
      if (QA_FORCED_KEYS.includes(key)) {
        return { enabled: true, reason: 'unleash' };
      }
    }
  }

  // Classification disclaimer gate override: refuse to enable classification
  // while any disclaimer is still PENDING in the signoff registry.
  const gate = gateRegistry.__contractorOpsClassificationGate;
  if (key === CLASSIFICATION_ENGINE_FLAG && base.enabled && gate) {
    const allApproved = gate();
    if (!allApproved) {
      log.warn(
        { organizationId: ctx.organizationId, flag: key },
        'classification-engine flag overridden to false: disclaimer(s) PENDING',
      );
      // Use a distinct reason so audit trails can distinguish a disclaimer-
      // blocked classification flag from a vanilla Unleash-disabled one.
      return { enabled: false, reason: 'disclaimer-pending' };
    }
  }

  return base;
}
