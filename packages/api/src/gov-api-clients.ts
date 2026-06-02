// ---------------------------------------------------------------------------
// Phase 57 · Plan 04 · Task 1 — gov-api client factory (env-driven singletons)
// ---------------------------------------------------------------------------
//
// Reads HMRC/VIES environment configuration once at first call and caches the
// `HmrcVatClient` + `ViesClient` instances for the process lifetime. The
// orchestrator (Plan 57-03 `validateTaxId`) and the `contractor.revalidateVat`
// tRPC mutation consume these through the exported `getHmrcVatClient()` /
// `getViesClient()` getters.
//
// Security / correctness invariants:
//   - `HMRC_PLATFORM_VRN` MUST be non-empty when `HMRC_ENV === 'production'`.
//     Without it, HMRC verified-lookup URLs are malformed (path misses the
//     second `/{requesterVrn}` segment) and degrade silently to unverified
//     responses — polluting the audit trail and breaking the
//     "platform-identified-requester" guarantee in T-57-02-04. The schema
//     `superRefine` AND a runtime `throw` (defense in depth) enforce this.
//   - Sandbox tolerates an empty `HMRC_PLATFORM_VRN`: the `verified-lookup`
//     path falls back to the unverified single-arg form.
//   - VIES has no sandbox base URL — we alias both environments to the same
//     canonical host and let MSW intercept in tests.
// ---------------------------------------------------------------------------

import type { GovApiEnvironment } from '@contractor-ops/gov-api';
import { HmrcVatClient, ViesClient } from '@contractor-ops/gov-api';
import { InfisicalSecretStore } from '@contractor-ops/integrations';
import type { SecretStore } from '@contractor-ops/secrets';
import { CachedStore, getSecretStore } from '@contractor-ops/secrets';
import { getServerEnv } from '@contractor-ops/validators';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Env schema — validates + enforces production-VRN invariant
// ---------------------------------------------------------------------------

const envSchema = z
  .object({
    HMRC_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
    VIES_ENV: z.enum(['sandbox', 'production']).default('production'),
    HMRC_PLATFORM_VRN: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.HMRC_ENV === 'production' &&
      (!val.HMRC_PLATFORM_VRN || val.HMRC_PLATFORM_VRN.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['HMRC_PLATFORM_VRN'],
        message:
          'HMRC_PLATFORM_VRN required in production (used as requesterVrn for verified /lookup/:target/:requester calls)',
      });
    }
  });

// ---------------------------------------------------------------------------
// Cached instances
// ---------------------------------------------------------------------------

let hmrcInstance: HmrcVatClient | null = null;
let viesInstance: ViesClient | null = null;

/**
 * Reset cached singletons. Exported for tests that mutate process.env across
 * scenarios — NEVER call from production code.
 */
export function resetGovApiClientsForTest(): void {
  hmrcInstance = null;
  viesInstance = null;
}

// ---------------------------------------------------------------------------
// Secret store resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the secret store backing HMRC OAuth-credential storage. When the
 * Infisical machine-identity vars (client id + secret + project id) are all
 * present, wire a CachedStore over a real InfisicalSecretStore; otherwise fall
 * back to the process-default store (in-memory for dev/test).
 *
 * Reads via `getServerEnv()` rather than raw `process.env` so the
 * `check:no-process-env` ratchet stays green.
 */
function resolveSecretStore(): SecretStore {
  const env = getServerEnv();
  if (env.INFISICAL_CLIENT_ID && env.INFISICAL_CLIENT_SECRET && env.INFISICAL_PROJECT_ID) {
    return new CachedStore(
      new InfisicalSecretStore({
        clientId: env.INFISICAL_CLIENT_ID,
        clientSecret: env.INFISICAL_CLIENT_SECRET,
        projectId: env.INFISICAL_PROJECT_ID,
        environment: env.INFISICAL_ENVIRONMENT ?? env.NODE_ENV,
        siteUrl: env.INFISICAL_SITE_URL,
      }),
    );
  }
  return getSecretStore();
}

// ---------------------------------------------------------------------------
// HMRC VAT client singleton
// ---------------------------------------------------------------------------

export function getHmrcVatClient(): HmrcVatClient {
  if (hmrcInstance) return hmrcInstance;

  const env = envSchema.parse(process.env);

  // Defense in depth: even if superRefine were bypassed (e.g. env mutation
  // between schema parse and this line, or a future refactor that drops the
  // refine), surface the invariant violation at first access.
  if (
    env.HMRC_ENV === 'production' &&
    (!env.HMRC_PLATFORM_VRN || env.HMRC_PLATFORM_VRN.length === 0)
  ) {
    throw new Error('HMRC_PLATFORM_VRN required in production');
  }

  hmrcInstance = new HmrcVatClient({
    config: {
      baseUrls: {
        sandbox: 'https://test-api.service.hmrc.gov.uk',
        production: 'https://api.service.hmrc.gov.uk',
      },
      timeoutMs: 30_000,
      retry: {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30_000,
        retryableStatuses: [500, 502, 503, 429],
      },
    },
    environment: env.HMRC_ENV as GovApiEnvironment,
    secretStore: resolveSecretStore(),
    // sandbox-only empty path — production path is guarded above.
    platformVrn: env.HMRC_PLATFORM_VRN ?? '',
    pkgVersion: process.env.npm_package_version ?? '0.0.0',
  });
  return hmrcInstance;
}

// ---------------------------------------------------------------------------
// VIES client singleton
// ---------------------------------------------------------------------------

export function getViesClient(): ViesClient {
  if (viesInstance) return viesInstance;

  const env = envSchema.parse(process.env);

  viesInstance = new ViesClient({
    config: {
      // VIES has no official sandbox — both environments resolve to the same
      // host; MSW intercepts in tests via matching URL prefix.
      baseUrls: {
        sandbox: 'https://ec.europa.eu/taxation_customs/vies',
        production: 'https://ec.europa.eu/taxation_customs/vies',
      },
      timeoutMs: 30_000,
      retry: {
        maxRetries: 2,
        baseDelayMs: 500,
        maxDelayMs: 5_000,
        retryableStatuses: [500, 502, 503],
      },
    },
    environment: env.VIES_ENV as GovApiEnvironment,
    // If the platform has a VRN registered for qualified confirmations we
    // forward it. Absent → qualified-lookup requests will throw up front in
    // the ViesClient (never silently degrade).
    requesterMemberStateCode: env.HMRC_PLATFORM_VRN ? 'GB' : undefined,
    requesterNumber: env.HMRC_PLATFORM_VRN,
  });
  return viesInstance;
}
