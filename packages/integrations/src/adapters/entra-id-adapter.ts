import { createHash, randomUUID } from 'node:crypto';
import type { ErrorClass } from '../idp/error-classifier.js';
import { classifyError } from '../idp/error-classifier.js';
import type { EntraImpactCustomMetrics, ImpactPreview } from '../idp/impact-preview.js';
import { ENTRA_DEPROVISION_SCOPES } from '../scopes/entra-deprovision-scopes.js';
import {
  canonicalizeRequest,
  canonicalizeResponse,
  sha256Hex,
} from '../services/saga-canonicalize.js';
import type { Deprovisionable, DeprovisionResult } from '../types/deprovisionable.js';
import type { OAuthConfig } from '../types/provider.js';
import { BaseAdapter } from './base-adapter.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// Single post-revoke signInActivity poll delay (CONTEXT.md D-03). A single
// delayed poll — never a tight loop. Tests fake the timer.
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
 * Microsoft Entra ID OAuth 2.0 app-only (client-credentials) config (CONTEXT.md
 * D-07). A SEPARATE Azure AD app from Outlook Calendar — Graph deprovision
 * scopes come from the typed-const ({@link ENTRA_DEPROVISION_SCOPES}); the
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

/**
 * Microsoft Entra ID `Deprovisionable` adapter (Phase 78 IDP-05) — the most
 * complex of the three, carrying TWO novel pre-flight gates.
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

  /** Best-effort Graph error code (`error.code`) from a non-2xx body. */
  static #providerErrorCode(body: unknown): string | undefined {
    const code = (body as { error?: { code?: string } })?.error?.code;
    return typeof code === 'string' ? code : undefined;
  }

  async suspendAccount(externalUserId: string): Promise<DeprovisionResult> {
    // Step 1 — hybrid-AD pre-flight read (CONTEXT.md D-02, SC#4). NO mutation yet.
    const preflightReqSha = sha256Hex(
      canonicalizeRequest({ method: 'GET', target: 'users.preflight', userId: externalUserId }),
    );
    const preRes = await fetch(
      `${this.#userUrl(externalUserId)}?$select=accountEnabled,onPremisesSyncEnabled`,
      { headers: this.#authHeaders() },
    );
    const preBody = (await preRes.json().catch(() => ({}))) as {
      accountEnabled?: boolean;
      onPremisesSyncEnabled?: boolean;
    };
    const preflightResSha = sha256Hex(
      canonicalizeResponse({ status: preRes.status, onPrem: preBody.onPremisesSyncEnabled }),
    );

    if (preRes.status === 404) {
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
      return this.#mapDeprovisionFailure(preRes.status, preBody, preflightReqSha, preflightResSha);
    }

    // Step 2 — HARD BLOCK on hybrid-AD authoritative accounts. Make NO PATCH call.
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

    // Step 3 — disable the account. Idempotent PATCH; client-request-id correlates retries.
    const requestPayload = { accountEnabled: false };
    const requestSha256 = sha256Hex(canonicalizeRequest({ method: 'PATCH', body: requestPayload }));
    const res = await fetch(this.#userUrl(externalUserId), {
      method: 'PATCH',
      headers: {
        ...this.#authHeaders(`entra:suspend:${externalUserId}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });
    const body = await res.json().catch(() => ({}));
    const responseSha256 = sha256Hex(canonicalizeResponse({ status: res.status, body }));

    if (res.ok) return { status: 'SUCCEEDED', requestSha256, responseSha256 };
    return this.#mapDeprovisionFailure(res.status, body, requestSha256, responseSha256);
  }

  async revokeAllSessions(externalUserId: string): Promise<DeprovisionResult> {
    const requestSha256 = sha256Hex(
      canonicalizeRequest({ method: 'POST', target: 'revokeSignInSessions' }),
    );
    const res = await fetch(`${this.#userUrl(externalUserId)}/revokeSignInSessions`, {
      method: 'POST',
      headers: this.#authHeaders(`entra:revoke:${externalUserId}`),
    });
    const body = await res.json().catch(() => ({}));
    const responseSha256 = sha256Hex(canonicalizeResponse({ status: res.status, body }));

    if (!res.ok) {
      return this.#mapDeprovisionFailure(res.status, body, requestSha256, responseSha256);
    }

    // Single delayed signInActivity poll (CONTEXT.md D-03) — supplementary
    // forensic data; never flips the step to FAILED. accountEnabled is the
    // authoritative verify (verifyDeprovisioned).
    let lastSignInDateTime: string | null = null;
    try {
      await new Promise(resolve => setTimeout(resolve, REVOKE_VERIFY_POLL_DELAY_MS));
      const pollRes = await fetch(`${this.#userUrl(externalUserId)}?$select=signInActivity`, {
        headers: this.#authHeaders(),
      });
      if (pollRes.ok) {
        const poll = (await pollRes.json().catch(() => ({}))) as {
          signInActivity?: { lastSignInDateTime?: string };
        };
        lastSignInDateTime = poll.signInActivity?.lastSignInDateTime ?? null;
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
      const res = await fetch(`${this.#userUrl(externalUserId)}?$select=accountEnabled`, {
        headers: this.#authHeaders(),
      });
      if (res.status === 404) return true; // gone is also deprovisioned
      if (!res.ok) return false;
      const body = (await res.json().catch(() => ({}))) as { accountEnabled?: boolean };
      return body.accountEnabled === false;
    } catch {
      return false;
    }
  }

  async describeImpact(externalUserId: string): Promise<ImpactPreview> {
    const cacheKey = `co:idp:preview:ENTRA_ID:${externalUserId}`;
    const fetchedAt = new Date().toISOString();

    // User read — accountStatus + onPremisesSyncEnabled + license SKUs. A total
    // failure here throws for the Phase 77 D-03 proceed-without-preview flow.
    const userRes = await fetch(
      `${this.#userUrl(externalUserId)}?$select=accountEnabled,onPremisesSyncEnabled,assignedLicenses,displayName`,
      { headers: this.#authHeaders() },
    );
    if (!userRes.ok && userRes.status !== 404) {
      throw new Error('entra describeImpact failed: user read unavailable');
    }
    const user = (await userRes.json().catch(() => ({}))) as {
      accountEnabled?: boolean;
      onPremisesSyncEnabled?: boolean;
      displayName?: string;
      assignedLicenses?: Array<{ skuId?: string }>;
    };
    const accountStatus: 'ACTIVE' | 'SUSPENDED' | 'NOT_FOUND' =
      userRes.status === 404 ? 'NOT_FOUND' : user.accountEnabled === false ? 'SUSPENDED' : 'ACTIVE';
    const assignedLicenseSkus = (user.assignedLicenses ?? [])
      .map(l => l.skuId)
      .filter((s): s is string => typeof s === 'string');

    // Conditional Access policies — NON-BLOCKING warning (CONTEXT.md D-01).
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
      cacheKey,
    };
  }

  /**
   * Enumerate enabled Conditional Access policies that apply to the user — a
   * NON-BLOCKING warning surfaced in the impact panel (a CA policy with session
   * controls can override revokeSignInSessions, Pitfall 14).
   */
  async #conditionalAccessForUser(
    externalUserId: string,
  ): Promise<EntraImpactCustomMetrics['conditionalAccessPolicies']> {
    try {
      const res = await fetch(`${GRAPH_BASE}/identity/conditionalAccess/policies`, {
        headers: this.#authHeaders(),
      });
      if (!res.ok) return [];
      const body = (await res.json().catch(() => ({}))) as {
        value?: Array<{
          displayName?: string;
          state?: string;
          conditions?: { users?: { includeUsers?: string[]; excludeUsers?: string[] } };
          sessionControls?: unknown;
        }>;
      };
      return (body.value ?? [])
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
      const res = await fetch(url, {
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
    const errorClass: ErrorClass = classifyError({
      provider: 'ENTRA',
      httpStatus,
      providerErrorCode,
    });

    if (errorClass === 'TRANSIENT_RATE_LIMIT' || errorClass === 'TRANSIENT_NETWORK') {
      throw new Error(`entra transient failure (${httpStatus}/${errorClass})`);
    }
    if (errorClass === 'PERMANENT_NOT_FOUND') {
      return {
        status: 'LIKELY_GONE',
        skipped: false,
        reason: 'user_not_found',
        failureKind: 'USER_NOT_FOUND',
        errorClass,
        requestSha256,
        responseSha256,
      };
    }
    return {
      status: 'FAILED',
      failureKind: errorClass === 'PERMANENT_AUTH_EXPIRED' ? 'AUTH_REVOKED' : 'PROVIDER_ERROR',
      errorClass,
      errorMessage:
        errorClass === 'PERMANENT_FORBIDDEN'
          ? `entra deprovision forbidden (${httpStatus}/${providerErrorCode ?? errorClass}) — check Graph app permissions`
          : `entra deprovision failed (${httpStatus}/${errorClass})`,
      requestSha256,
      responseSha256,
    };
  }
}
