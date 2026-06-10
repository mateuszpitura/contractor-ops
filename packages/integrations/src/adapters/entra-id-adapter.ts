import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { mapErrorClassToResult } from '../idp/deprovision-result.js';
import { classifyError } from '../idp/error-classifier.js';
import type { EntraImpactCustomMetrics, ImpactPreview } from '../idp/impact-preview.js';
import { ENTRA_DEPROVISION_SCOPES } from '../scopes/entra-deprovision-scopes.js';
import { fetchWithTimeout } from '../services/fetch-helpers.js';
import { safeParseJsonResponse } from '../services/parse-json-response.js';
import { withResilience } from '../services/resilience.js';
import {
  canonicalizeRequest,
  canonicalizeResponse,
  sha256Hex,
} from '../services/saga-canonicalize.js';
import type { Deprovisionable, DeprovisionResult } from '../types/deprovisionable.js';
import type { OAuthConfig } from '../types/provider.js';
import { BaseAdapter } from './base-adapter.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// Deprovision Graph mutations (suspend, revoke-sessions, verify, describeImpact,
// conditionalAccess, $count). 15s wall-clock, no retries — QStash retries the
// whole step on transient failure via #mapDeprovisionFailure throwing.
const DEPROVISION_TIMEOUT_MS = 15_000;

// Single post-revoke signInActivity poll delay. Never a tight loop — tests
// fake the timer.
const REVOKE_VERIFY_POLL_DELAY_MS = 2_000;

/**
 * Derive a deterministic v4-shaped UUID for the Graph `client-request-id`
 * header (mirrors `encodeMicrosoftClientRequestId` in outlook-calendar-adapter.ts —
 * Graph requires a UUID; same input → same correlation id for dedup telemetry).
 */
function encodeMicrosoftClientRequestId(idempotencyKey: string): string {
  const digest = createHash('sha256').update(idempotencyKey).digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Microsoft Entra ID OAuth 2.0 app-only (client-credentials) config.
 * A SEPARATE Azure AD app from Outlook Calendar — Graph deprovision scopes
 * come from the typed-const ({@link ENTRA_DEPROVISION_SCOPES}); the
 * lint:scopes guard traces the adapter's scopes back to that const.
 */
const ENTRA_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: 'ENTRA_CLIENT_ID',
  clientSecretEnvVar: 'ENTRA_CLIENT_SECRET',
  authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  scopes: [...ENTRA_DEPROVISION_SCOPES],
  redirectPath: '/api/oauth/entra/callback',
};

// ---------------------------------------------------------------------------
// Minimal Zod schemas for the Graph response bodies we read.
// Partial objects (passthrough) so unrecognised fields are ignored; fields we
// branch on are typed. A parse failure is a hard-fail — an unknown shape cannot
// be silently coerced (the hybrid-AD gate in particular must NOT fail open).
// ---------------------------------------------------------------------------

/** GET /users/{id}?$select=accountEnabled,onPremisesSyncEnabled — hybrid-AD pre-flight. */
const GraphUserPreflightSchema = z
  .object({
    accountEnabled: z.boolean().optional(),
    onPremisesSyncEnabled: z.boolean().optional(),
  })
  .passthrough();

/** GET /users/{id}?$select=accountEnabled — verify step. */
const GraphUserAccountEnabledSchema = z
  .object({
    accountEnabled: z.boolean().optional(),
  })
  .passthrough();

/** GET /users/{id}?$select=signInActivity — post-revoke forensic poll. */
const GraphUserSignInActivitySchema = z
  .object({
    signInActivity: z
      .object({
        lastSignInDateTime: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

/** GET /users/{id}?$select=accountEnabled,onPremisesSyncEnabled,assignedLicenses,displayName — describeImpact. */
const GraphUserDescribeImpactSchema = z
  .object({
    accountEnabled: z.boolean().optional(),
    onPremisesSyncEnabled: z.boolean().optional(),
    displayName: z.string().optional(),
    assignedLicenses: z.array(z.object({ skuId: z.string().optional() }).passthrough()).optional(),
  })
  .passthrough();

/** GET /identity/conditionalAccess/policies — CA policy list. */
const GraphConditionalAccessPoliciesSchema = z
  .object({
    value: z
      .array(
        z
          .object({
            displayName: z.string().optional(),
            state: z.string().optional(),
            conditions: z
              .object({
                users: z
                  .object({
                    includeUsers: z.array(z.string()).optional(),
                    excludeUsers: z.array(z.string()).optional(),
                  })
                  .optional(),
              })
              .optional(),
            sessionControls: z.unknown().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

/** Non-2xx Graph error body — best-effort `error.code` extraction. */
const GraphErrorBodySchema = z
  .object({
    error: z.object({ code: z.string().optional() }).optional(),
  })
  .passthrough();

/**
 * Microsoft Entra ID `Deprovisionable` adapter — carries two pre-flight gates.
 *
 * Follows the OutlookCalendarAdapter raw-Graph pattern (same IdP host, no new
 * SDK — `@microsoft/microsoft-graph-client` is NOT a dependency). The app-only
 * Graph token is carried on the instance via {@link withAccessToken} by the saga
 * step-runner. The token is NEVER embedded in a thrown Error or logged.
 *
 *   - suspendAccount    → hybrid-AD HARD BLOCK (onPremisesSyncEnabled), then
 *                         PATCH /users/{id} { accountEnabled:false }
 *   - revokeAllSessions → POST /users/{id}/revokeSignInSessions, then a SINGLE
 *                         delayed signInActivity poll (forensic, never fails the step)
 *   - verifyDeprovisioned → GET accountEnabled === false / 404 → true
 *   - describeImpact    → Conditional Access policies (NON-BLOCKING warning) +
 *                         license/group/device/app-role metrics
 */
export class EntraIdAdapter extends BaseAdapter implements Deprovisionable {
  readonly slug = 'entra-id';
  readonly displayName = 'Microsoft Entra ID';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;

  #accessToken = '';

  /** Configure the app-only Graph token for the Deprovisionable methods (saga step-runner). */
  withAccessToken(accessToken: string): this {
    this.#accessToken = accessToken;
    return this;
  }

  override getOAuthConfig(): OAuthConfig {
    return ENTRA_OAUTH_CONFIG;
  }

  #userUrl(externalUserId: string): string {
    return `${GRAPH_BASE}/users/${encodeURIComponent(externalUserId)}`;
  }

  #authHeaders(idempotencyKey?: string): Record<string, string> {
    return {
      Authorization: `Bearer ${this.#accessToken}`,
      'client-request-id': idempotencyKey
        ? encodeMicrosoftClientRequestId(idempotencyKey)
        : randomUUID(),
    };
  }

  /**
   * Graph fetch helper — mirrors Slack's `#scimFetch`/`#adminApi` pattern.
   * Wraps `fetchWithTimeout` in `withResilience` (circuit-breaker + bulkhead)
   * so every Graph call benefits from the package's resilience seam.
   */
  async #graphFetch(url: string, init: RequestInit): Promise<Response> {
    return withResilience(
      () => fetchWithTimeout(url, init, { timeoutMs: DEPROVISION_TIMEOUT_MS, retries: 0 }),
      { provider: 'entra' },
    );
  }

  /** Best-effort Graph error code (`error.code`) from a validated error body. */
  static #providerErrorCode(body: unknown): string | undefined {
    const parsed = GraphErrorBodySchema.safeParse(body);
    const code = parsed.success ? parsed.data.error?.code : undefined;
    return typeof code === 'string' ? code : undefined;
  }

  async suspendAccount(externalUserId: string): Promise<DeprovisionResult> {
    // Step 1 — hybrid-AD pre-flight read. NO mutation yet.
    const preflightReqSha = sha256Hex(
      canonicalizeRequest({ method: 'GET', target: 'users.preflight', userId: externalUserId }),
    );
    const preRes = await this.#graphFetch(
      `${this.#userUrl(externalUserId)}?$select=accountEnabled,onPremisesSyncEnabled`,
      { headers: this.#authHeaders() },
    );

    if (preRes.status === 404) {
      const preflightResSha = sha256Hex(canonicalizeResponse({ status: 404 }));
      // Already gone — idempotent LIKELY_GONE, no write.
      return {
        status: 'LIKELY_GONE',
        skipped: true,
        reason: 'user_not_found',
        failureKind: 'USER_NOT_FOUND',
        errorClass: 'PERMANENT_NOT_FOUND',
        requestSha256: preflightReqSha,
        responseSha256: preflightResSha,
      };
    }

    if (!preRes.ok) {
      // Non-2xx non-404: parse error body best-effort for classifier.
      const errParsed = await safeParseJsonResponse(
        preRes,
        GraphErrorBodySchema,
        'entra:suspendAccount:preflight',
      );
      const errBody = errParsed.success ? errParsed.data : {};
      const preflightResSha = sha256Hex(canonicalizeResponse({ status: preRes.status }));
      return this.#mapDeprovisionFailure(preRes.status, errBody, preflightReqSha, preflightResSha);
    }

    // Step 2 — parse and validate the pre-flight body.
    // A drifted/malformed body MUST hard-fail here: the hybrid-AD gate cannot
    // fail open (coercing `undefined` to `false` would silently skip the block).
    const preParsed = await safeParseJsonResponse(
      preRes,
      GraphUserPreflightSchema,
      'entra:suspendAccount:preflight',
    );
    if (!preParsed.success) {
      const preflightResSha = sha256Hex(
        canonicalizeResponse({ status: preRes.status, parseError: true }),
      );
      return {
        status: 'FAILED',
        failureKind: 'PROVIDER_ERROR',
        errorClass: 'PERMANENT_OTHER',
        errorMessage:
          'entra hybrid-AD pre-flight body failed schema validation — cannot proceed safely',
        requestSha256: preflightReqSha,
        responseSha256: preflightResSha,
      };
    }
    const preBody = preParsed.data;
    const preflightResSha = sha256Hex(
      canonicalizeResponse({ status: preRes.status, onPrem: preBody.onPremisesSyncEnabled }),
    );

    // Step 3 — HARD BLOCK on hybrid-AD authoritative accounts. Make NO PATCH call.
    if (preBody.onPremisesSyncEnabled === true) {
      return {
        status: 'FAILED',
        failureKind: 'PROVIDER_ERROR',
        errorClass: 'PERMANENT_FORBIDDEN',
        errorMessage: 'On-prem AD authoritative — revoke at source',
        reason: 'hybrid_ad_authoritative',
        requestSha256: preflightReqSha,
        responseSha256: preflightResSha,
      };
    }

    // Step 4 — disable the account. Idempotent PATCH; client-request-id correlates retries.
    const requestPayload = { accountEnabled: false };
    const requestSha256 = sha256Hex(canonicalizeRequest({ method: 'PATCH', body: requestPayload }));
    const res = await this.#graphFetch(this.#userUrl(externalUserId), {
      method: 'PATCH',
      headers: {
        ...this.#authHeaders(`entra:suspend:${externalUserId}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });
    const responseSha256 = sha256Hex(canonicalizeResponse({ status: res.status }));

    if (res.ok) return { status: 'SUCCEEDED', requestSha256, responseSha256 };
    const patchErrParsed = await safeParseJsonResponse(
      res,
      GraphErrorBodySchema,
      'entra:suspendAccount:patch',
    );
    const patchErrBody = patchErrParsed.success ? patchErrParsed.data : {};
    return this.#mapDeprovisionFailure(res.status, patchErrBody, requestSha256, responseSha256);
  }

  async revokeAllSessions(externalUserId: string): Promise<DeprovisionResult> {
    const requestSha256 = sha256Hex(
      canonicalizeRequest({ method: 'POST', target: 'revokeSignInSessions' }),
    );
    const res = await this.#graphFetch(`${this.#userUrl(externalUserId)}/revokeSignInSessions`, {
      method: 'POST',
      headers: this.#authHeaders(`entra:revoke:${externalUserId}`),
    });
    const responseSha256 = sha256Hex(canonicalizeResponse({ status: res.status }));

    if (!res.ok) {
      const errParsed = await safeParseJsonResponse(
        res,
        GraphErrorBodySchema,
        'entra:revokeAllSessions',
      );
      const errBody = errParsed.success ? errParsed.data : {};
      return this.#mapDeprovisionFailure(res.status, errBody, requestSha256, responseSha256);
    }

    // Single delayed signInActivity poll — supplementary forensic data; never
    // flips the step to FAILED. accountEnabled is the authoritative verify
    // (verifyDeprovisioned).
    let lastSignInDateTime: string | null = null;
    try {
      await new Promise(resolve => setTimeout(resolve, REVOKE_VERIFY_POLL_DELAY_MS));
      const pollRes = await this.#graphFetch(
        `${this.#userUrl(externalUserId)}?$select=signInActivity`,
        { headers: this.#authHeaders() },
      );
      if (pollRes.ok) {
        const pollParsed = await safeParseJsonResponse(
          pollRes,
          GraphUserSignInActivitySchema,
          'entra:revokeAllSessions:poll',
        );
        if (pollParsed.success) {
          lastSignInDateTime = pollParsed.data.signInActivity?.lastSignInDateTime ?? null;
        }
      }
    } catch {
      lastSignInDateTime = null;
    }

    return {
      status: 'SUCCEEDED',
      requestSha256,
      responseSha256,
      reason: lastSignInDateTime
        ? `last sign-in (forensic): ${lastSignInDateTime}`
        : 'sign-in activity poll unavailable',
    };
  }

  async verifyDeprovisioned(externalUserId: string): Promise<boolean> {
    try {
      const res = await this.#graphFetch(
        `${this.#userUrl(externalUserId)}?$select=accountEnabled`,
        { headers: this.#authHeaders() },
      );
      if (res.status === 404) return true; // gone is also deprovisioned
      if (!res.ok) return false;
      const parsed = await safeParseJsonResponse(
        res,
        GraphUserAccountEnabledSchema,
        'entra:verifyDeprovisioned',
      );
      if (!parsed.success) return false;
      return parsed.data.accountEnabled === false;
    } catch {
      return false;
    }
  }

  async describeImpact(externalUserId: string): Promise<ImpactPreview> {
    const fetchedAt = new Date().toISOString();

    // User read — accountStatus + onPremisesSyncEnabled + license SKUs. A total
    // failure here throws for the proceed-without-preview flow.
    const userRes = await this.#graphFetch(
      `${this.#userUrl(externalUserId)}?$select=accountEnabled,onPremisesSyncEnabled,assignedLicenses,displayName`,
      { headers: this.#authHeaders() },
    );
    if (!userRes.ok && userRes.status !== 404) {
      throw new Error('entra describeImpact failed: user read unavailable');
    }
    const userParsed = await safeParseJsonResponse(
      userRes,
      GraphUserDescribeImpactSchema,
      'entra:describeImpact:user',
    );
    const user = userParsed.success ? userParsed.data : {};
    const accountStatus: 'ACTIVE' | 'SUSPENDED' | 'NOT_FOUND' =
      userRes.status === 404 ? 'NOT_FOUND' : user.accountEnabled === false ? 'SUSPENDED' : 'ACTIVE';
    const assignedLicenseSkus = (user.assignedLicenses ?? [])
      .map(l => l.skuId)
      .filter((s): s is string => typeof s === 'string');

    // Conditional Access policies — NON-BLOCKING warning.
    const conditionalAccessPolicies = await this.#conditionalAccessForUser(externalUserId);

    const groupMembershipCount = await this.#count(
      `${this.#userUrl(externalUserId)}/memberOf/$count`,
    );
    const registeredDeviceCount = await this.#count(
      `${this.#userUrl(externalUserId)}/registeredDevices/$count`,
    );
    const appRoleAssignmentCount = await this.#count(
      `${this.#userUrl(externalUserId)}/appRoleAssignments/$count`,
    );

    const customMetrics: EntraImpactCustomMetrics = {
      conditionalAccessPolicies,
      assignedLicenseSkus,
      groupMembershipCount,
      onPremisesSyncEnabled: user.onPremisesSyncEnabled === true,
      registeredDeviceCount,
      appRoleAssignmentCount,
    };

    return {
      provider: 'ENTRA',
      commonMetrics: {
        externalUserId,
        externalUserDisplayName: user.displayName ?? externalUserId,
        accountStatus,
        sessionCount: null, // Graph has no live session-count endpoint
      },
      customMetrics,
      fetchedAt,
    };
  }

  /**
   * Enumerate enabled Conditional Access policies that apply to the user — a
   * NON-BLOCKING warning surfaced in the impact panel. A CA policy with session
   * controls can override revokeSignInSessions.
   */
  async #conditionalAccessForUser(
    externalUserId: string,
  ): Promise<EntraImpactCustomMetrics['conditionalAccessPolicies']> {
    try {
      const res = await this.#graphFetch(`${GRAPH_BASE}/identity/conditionalAccess/policies`, {
        headers: this.#authHeaders(),
      });
      if (!res.ok) return [];
      const parsed = await safeParseJsonResponse(
        res,
        GraphConditionalAccessPoliciesSchema,
        'entra:conditionalAccess',
      );
      if (!parsed.success) return [];
      return (parsed.data.value ?? [])
        .filter(p => p.state === 'enabled')
        .map(p => {
          const include = p.conditions?.users?.includeUsers ?? [];
          const exclude = p.conditions?.users?.excludeUsers ?? [];
          const appliesToUser =
            (include.includes('All') || include.includes(externalUserId)) &&
            !exclude.includes(externalUserId);
          return {
            displayName: p.displayName ?? 'unnamed policy',
            state: p.state ?? 'unknown',
            appliesToUser,
            hasSessionControls: p.sessionControls != null,
          };
        });
    } catch {
      return [];
    }
  }

  /** Best-effort Graph `$count` read (ConsistencyLevel: eventual) → number, 0 on failure. */
  async #count(url: string): Promise<number> {
    try {
      const res = await this.#graphFetch(url, {
        headers: { ...this.#authHeaders(), ConsistencyLevel: 'eventual' },
      });
      if (!res.ok) return 0;
      const text = await res.text().catch(() => '');
      const n = Number.parseInt(text.trim(), 10);
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Maps a non-2xx Graph deprovision response to a DeprovisionResult via the
   * closed-enum classifier. TRANSIENT_* THROWS (QStash retries the step);
   * 403 Authorization_RequestDenied → PERMANENT_FORBIDDEN (no retry).
   */
  #mapDeprovisionFailure(
    httpStatus: number,
    body: unknown,
    requestSha256: string,
    responseSha256: string,
  ): DeprovisionResult {
    const providerErrorCode = EntraIdAdapter.#providerErrorCode(body);
    const errorClass = classifyError({ provider: 'ENTRA', httpStatus, providerErrorCode });
    const failedDetail =
      errorClass === 'PERMANENT_FORBIDDEN'
        ? `entra deprovision forbidden (${httpStatus}/${providerErrorCode ?? errorClass}) — check Graph app permissions`
        : `entra deprovision failed (${httpStatus}/${errorClass})`;
    return mapErrorClassToResult(errorClass, {
      requestSha256,
      responseSha256,
      notFoundReason: 'user_not_found',
      transientDetail: `entra transient failure (${httpStatus})`,
      failedDetail,
    });
  }
}
