// Phase 56 · Plan 07 — IDOR guard for privacy-notice PDF generation.
//
// Pure, side-effect-free assertion used by the server-side tRPC mutation
// (`packages/api/src/routers/legal.ts`) AND by the privacy-de test scaffold.
// Co-locating it in `apps/web/src/server/api/routers/` keeps the shape the
// Wave 0 test expects (`@/server/api/routers/privacy-pdf.guard`) while
// allowing the API package to import the exact same function.
//
// Contract (ASVS V4 Access Control):
//   1. Client requests MUST NOT supply a `jurisdiction` field. Input schema
//      in `legal.ts` is `z.object({}).optional()` — any extra property is
//      ignored by Zod's default strip behaviour, so this guard is a
//      defence-in-depth check for explicit mismatches passed via internal
//      callers (tests, cron jobs, future server code).
//   2. Jurisdiction is ALWAYS derived from
//      `ctx.session.user.organization.countryCode` via
//      `resolveJurisdiction()` from `@contractor-ops/validators`.
//   3. If a caller supplies `requestedJurisdiction` that doesn't match the
//      session-derived jurisdiction, this function throws — preventing a
//      future refactor from quietly re-introducing an IDOR.

import type { SupportedJurisdiction } from '@contractor-ops/validators';
import { resolveJurisdiction } from '@contractor-ops/validators';

export interface AssertJurisdictionArgs {
  /** Organization.countryCode from the authenticated session. */
  sessionOrgCountryCode: string | null | undefined;
  /** Jurisdiction hint from the caller — MUST match the session-derived
   *  jurisdiction or be undefined. */
  requestedJurisdiction?: string;
}

/**
 * Resolve the jurisdiction server-side. If the caller supplies a hint that
 * contradicts the session, throw — preventing cross-tenant PDF leakage.
 */
export function assertJurisdictionOrReject(args: AssertJurisdictionArgs): SupportedJurisdiction {
  const sessionJurisdiction = resolveJurisdiction(args.sessionOrgCountryCode);

  if (args.requestedJurisdiction !== undefined) {
    const requested = args.requestedJurisdiction.toUpperCase();
    if (requested !== sessionJurisdiction) {
      throw new Error(
        `Jurisdiction mismatch: session resolves to '${sessionJurisdiction}' but caller requested '${requested}'. Refusing to generate PDF (ASVS V4).`,
      );
    }
  }

  return sessionJurisdiction;
}
