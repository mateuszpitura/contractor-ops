import { getServerEnv } from '@contractor-ops/validators';

/**
 * Demo read-only signal — the single predicate behind both enforcement layers
 * (the `demoReadOnly` tRPC mutation guard and the service-layer outbound skip).
 *
 * Demo status is env-controlled ONLY:
 *   - `DEMO_MODE=true`  → the whole deployment is read-only (every org).
 *   - `DEMO_ORG_IDS`    → the listed org IDs are read-only on a shared deploy.
 *
 * It is never derived from `metadata.profile` (mutable → not a trust boundary).
 * `getServerEnv()` is parsed and cached once at boot, so this stays sync + cheap
 * (a boolean read plus an `includes` over a tiny array) — safe to call from the
 * hot `authedProcedure` middleware path.
 */
/**
 * Sandbox org ids seen in this process. Populated whenever a `co_test_` key
 * resolves (api-key-service), so the sync `isDemoOrg` side-effect skips
 * (outbox/email/ZATCA/payout) also cover a persistent sandbox org without a DB
 * query on the hot path. Defense-in-depth: a sandbox org is already read-only at
 * the mutation guard (via a context `isSandbox` flag), so it never reaches these
 * chokepoints — but if it ever did, the skip still fires.
 */
const sandboxOrgIds = new Set<string>();

/** Record an org as a sandbox so the sync demo skips honor it in this process. */
export function markSandboxOrg(orgId: string): void {
  sandboxOrgIds.add(orgId);
}

export function isDemoOrg(orgId: string | null | undefined): boolean {
  const env = getServerEnv();
  if (env.DEMO_MODE) return true;
  if (!orgId) return false;
  if (sandboxOrgIds.has(orgId)) return true;
  // `?? []` is defensive: the schema always materializes an array, but partial
  // `getServerEnv` mocks in unrelated tests may omit it — never throw here on
  // the hot guard path.
  return (env.DEMO_ORG_IDS ?? []).includes(orgId);
}

/**
 * True only when the whole deployment is demo (`DEMO_MODE=true`), independent of
 * any org. Used by org-agnostic outbound chokepoints that have no org id in
 * scope (e.g. `sendAppEmail`, which also serves pre-tenancy auth flows). On a
 * shared deploy that uses `DEMO_ORG_IDS`, those org-less paths cannot be scoped;
 * org-scoped outbound is caught one level up (e.g. `dispatch`).
 */
export function isGlobalDemo(): boolean {
  return getServerEnv().DEMO_MODE;
}

/** Minimal structural view of the tRPC context needed to resolve the demo org. */
type DemoContext = {
  organizationId?: string | null;
  // Set by the API-key auth middleware from the resolved key's org: a sandbox
  // org is demo-isolated regardless of the env DEMO_* config.
  isSandbox?: boolean | null;
  session?: { session?: { activeOrganizationId?: string | null } | null } | null;
};

/**
 * The org id a demo check applies to. Prefers `ctx.organizationId` (set once a
 * tenant/portal/api-key middleware resolved it); falls back to the session's
 * `activeOrganizationId` (the staff `authedProcedure` runs the guard *before*
 * `tenantMiddleware` sets `ctx.organizationId`). `null` when neither is present.
 */
export function resolveDemoOrgId(ctx: DemoContext): string | null {
  return ctx.organizationId ?? ctx.session?.session?.activeOrganizationId ?? null;
}

/**
 * Resolves the demo signal from a tRPC context. When no org is resolvable, only
 * a global `DEMO_MODE` deployment is treated as demo.
 */
export function isDemoContext(ctx: DemoContext): boolean {
  if (ctx.isSandbox === true) return true;
  return isDemoOrg(resolveDemoOrgId(ctx));
}
