import OktaSdk, { type Client } from '@okta/okta-sdk-nodejs';
import { mapErrorClassToResult } from '../idp/deprovision-result.js';
import { classifyError } from '../idp/error-classifier.js';
import type { ImpactPreview } from '../idp/impact-preview.js';
import {
  canonicalizeRequest,
  canonicalizeResponse,
  sha256Hex,
} from '../services/saga-canonicalize.js';
import type { Deprovisionable, DeprovisionResult } from '../types/deprovisionable.js';
import type { GetHealthStatusOptions } from './base-adapter.js';
import { BaseAdapter } from './base-adapter.js';

// `@okta/okta-sdk-nodejs` v8 is CommonJS: the `.d.ts` presents named exports,
// but `Client` is attached to `module.exports` at runtime — a named ESM import
// resolves to undefined. Default-import the namespace and destructure the value.
const { Client: OktaClient } = OktaSdk;

/**
 * Okta `Deprovisionable` adapter.
 *
 * Uses the official `@okta/okta-sdk-nodejs` v8 namespaced client with an
 * API-token auth model, mirroring the KSeF/Clockify API-key adapters.
 * The saga step-runner resolves the org URL + API token from the decrypted
 * `IntegrationConnection.credentials` and configures the instance via
 * {@link withCredentials} before invoking suspend/revoke.
 *
 * Maps the interface onto Okta's lifecycle API:
 *   - suspendAccount    → userApi.deactivateUser (→ DEPROVISIONED)
 *   - revokeAllSessions → userApi.revokeUserSessions
 *   - verifyDeprovisioned → userApi.getUser (status DEPROVISIONED / 404 → true)
 *   - describeImpact    → app/factor/group/role/idp counts (best-effort)
 *
 * SDK errors surface an HTTP `status`; classifyError maps them. The API token
 * is NEVER logged or embedded in thrown Error messages.
 */
export class OktaAdapter extends BaseAdapter implements Deprovisionable {
  readonly slug = 'okta';
  readonly displayName = 'Okta';
  readonly supportsOAuth = false;
  readonly supportsWebhooks = false;

  #orgUrl = '';
  #token = '';

  /** Configure the org URL + API token for the Deprovisionable methods (saga step-runner). */
  withCredentials(orgUrl: string, token: string): this {
    this.#orgUrl = orgUrl;
    this.#token = token;
    return this;
  }

  /** Fresh SDK client bound to the configured org URL + token. */
  #client(): Client {
    return new OktaClient({ orgUrl: this.#orgUrl, token: this.#token });
  }

  /**
   * Okta API token is a non-expiring credential — skip the token-expiry
   * derivation step (KSeF/Clockify precedent).
   */
  override async getHealthStatus(connectionId: string, options?: GetHealthStatusOptions) {
    return super.getHealthStatus(connectionId, { ...options, includeTokenExpiry: false });
  }

  /** Best-effort HTTP status from an Okta SDK error (surfaces `status`). */
  static #httpStatus(err: unknown): number | undefined {
    if (err && typeof err === 'object' && 'status' in err) {
      const s = (err as { status: unknown }).status;
      if (typeof s === 'number') return s;
    }
    return;
  }

  /** Okta error code (e.g. `E0000007`) from an SDK error, for audit context only. */
  static #errorCode(err: unknown): string | undefined {
    if (err && typeof err === 'object' && 'errorCode' in err) {
      const c = (err as { errorCode: unknown }).errorCode;
      if (typeof c === 'string') return c;
    }
    return;
  }

  async suspendAccount(externalUserId: string): Promise<DeprovisionResult> {
    const requestSha256 = sha256Hex(
      canonicalizeRequest({ op: 'deactivate', userId: externalUserId }),
    );

    // Verify-first short-circuit: an already-DEPROVISIONED (or absent) user is
    // an idempotent LIKELY_GONE — no deactivate call.
    const alreadyGone = await this.#isAlreadyGone(externalUserId);
    if (alreadyGone) {
      return {
        status: 'LIKELY_GONE',
        skipped: true,
        reason: 'already_deprovisioned',
        failureKind: 'USER_NOT_FOUND',
        errorClass: 'PERMANENT_NOT_FOUND',
        requestSha256,
        responseSha256: sha256Hex(canonicalizeResponse({ alreadyGone: true })),
      };
    }

    try {
      await this.#client().userApi.deactivateUser({ userId: externalUserId, sendEmail: false });
      return {
        status: 'SUCCEEDED',
        requestSha256,
        responseSha256: sha256Hex(canonicalizeResponse({ op: 'deactivate', ok: true })),
      };
    } catch (err) {
      return this.#mapFailure(err, requestSha256, 'deactivate');
    }
  }

  async revokeAllSessions(externalUserId: string): Promise<DeprovisionResult> {
    const requestSha256 = sha256Hex(
      canonicalizeRequest({ op: 'revokeUserSessions', userId: externalUserId }),
    );
    try {
      await this.#client().userApi.revokeUserSessions({ userId: externalUserId });
      return {
        status: 'SUCCEEDED',
        requestSha256,
        responseSha256: sha256Hex(canonicalizeResponse({ op: 'revokeUserSessions', ok: true })),
      };
    } catch (err) {
      return this.#mapFailure(err, requestSha256, 'revokeUserSessions');
    }
  }

  async verifyDeprovisioned(externalUserId: string): Promise<boolean> {
    try {
      const user = await this.#client().userApi.getUser({ userId: externalUserId });
      return user.status === 'DEPROVISIONED';
    } catch (err) {
      // 404 (user gone) is also "deprovisioned"; any other error → false (never throw).
      return OktaAdapter.#httpStatus(err) === 404;
    }
  }

  /** Verify-first helper for the suspend short-circuit (DEPROVISIONED or 404). */
  async #isAlreadyGone(externalUserId: string): Promise<boolean> {
    try {
      const user = await this.#client().userApi.getUser({ userId: externalUserId });
      return user.status === 'DEPROVISIONED';
    } catch (err) {
      return OktaAdapter.#httpStatus(err) === 404;
    }
  }

  async describeImpact(externalUserId: string): Promise<ImpactPreview> {
    const fetchedAt = new Date().toISOString();
    const client = this.#client();

    // getUser — accountStatus + displayName. A total failure here (the user
    // read) throws so callers can choose to proceed without a preview.
    let accountStatus: 'ACTIVE' | 'SUSPENDED' | 'NOT_FOUND' = 'ACTIVE';
    let displayName = externalUserId;
    try {
      const user = await client.userApi.getUser({ userId: externalUserId });
      const status = user.status ?? 'ACTIVE';
      accountStatus =
        status === 'DEPROVISIONED' ? 'NOT_FOUND' : status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
      const profile = user.profile as
        | { displayName?: string; login?: string; email?: string }
        | undefined;
      displayName = profile?.displayName ?? profile?.login ?? profile?.email ?? externalUserId;
    } catch (err) {
      if (OktaAdapter.#httpStatus(err) === 404) {
        accountStatus = 'NOT_FOUND';
      } else {
        throw new Error('okta describeImpact failed: user read unavailable');
      }
    }

    const groupMembershipCount = await OktaAdapter.#count(() =>
      client.userApi.listUserGroups({ userId: externalUserId }),
    );
    const assignedAppCount = await OktaAdapter.#count(() =>
      client.userApi.listAppLinks({ userId: externalUserId }),
    );
    const linkedIdpCount = await OktaAdapter.#count(() =>
      client.userApi.listUserIdentityProviders({ userId: externalUserId }),
    );
    const enrolledFactorTypes = await OktaAdapter.#collect(
      () => client.userFactorApi.listFactors({ userId: externalUserId }),
      f => (f as { factorType?: string }).factorType,
    );
    const adminRoles = await OktaAdapter.#collect(
      () => client.roleAssignmentApi.listAssignedRolesForUser({ userId: externalUserId }),
      r => (r as { type?: string; label?: string }).label ?? (r as { type?: string }).type,
    );

    return {
      provider: 'OKTA',
      commonMetrics: {
        externalUserId,
        externalUserDisplayName: displayName,
        accountStatus,
        sessionCount: null,
      },
      customMetrics: {
        assignedAppCount,
        enrolledFactorTypes,
        groupMembershipCount,
        adminRoles,
        linkedIdpCount,
      },
      fetchedAt,
    };
  }

  /** Best-effort count of an Okta SDK async-iterable collection (→ 0 on failure). */
  static async #count(
    fetcher: () => AsyncIterable<unknown> | Promise<AsyncIterable<unknown>>,
  ): Promise<number> {
    try {
      const iterable = await fetcher();
      let n = 0;
      for await (const _ of iterable) n++;
      return n;
    } catch {
      return 0;
    }
  }

  /** Best-effort collect-and-map of an Okta SDK collection (→ [] on failure). */
  static async #collect<T>(
    fetcher: () => AsyncIterable<unknown> | Promise<AsyncIterable<unknown>>,
    map: (item: unknown) => T | undefined,
  ): Promise<T[]> {
    try {
      const iterable = await fetcher();
      const out: T[] = [];
      for await (const item of iterable) {
        const mapped = map(item);
        if (mapped !== undefined) out.push(mapped);
      }
      return out;
    } catch {
      return [];
    }
  }

  /**
   * Maps an Okta SDK error to a DeprovisionResult via the closed-enum
   * classifier. TRANSIENT_* re-throws so the QStash step-runner retries.
   */
  #mapFailure(err: unknown, requestSha256: string, op: string): DeprovisionResult {
    const httpStatus = OktaAdapter.#httpStatus(err);
    const errorCode = OktaAdapter.#errorCode(err);
    // No HTTP status → treat as a transport/network failure (retryable).
    const errorClass =
      httpStatus === undefined
        ? classifyError({ provider: 'OKTA', cause: err })
        : classifyError({ provider: 'OKTA', httpStatus, providerErrorCode: errorCode });
    const responseSha256 = sha256Hex(canonicalizeResponse({ op, httpStatus: httpStatus ?? null }));
    return mapErrorClassToResult(errorClass, {
      requestSha256,
      responseSha256,
      notFoundReason: 'user_not_found',
      transientDetail: `okta transient failure (${httpStatus ?? 'network'})`,
      failedDetail: `okta deprovision failed (${httpStatus ?? 'unknown'}/${errorClass})`,
    });
  }
}
