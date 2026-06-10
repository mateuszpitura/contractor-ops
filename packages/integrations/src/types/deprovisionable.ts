// Deprovisionable contract.
//
// Every IdP-capable adapter MUST implement this interface. Compile-time enforcement
// happens at the registry boundary: `registerDeprovisionableAdapter(provider, adapter)`
// only accepts an adapter typed as `BaseAdapter & Deprovisionable` — a class that
// forgets one of the methods will not compile when registered.

import type { ErrorClass } from '../idp/error-classifier.js';
import type { ImpactPreview } from '../idp/impact-preview.js';

/**
 * Status of an individual deprovisioning method call.
 *
 * Additively extended with `LIKELY_GONE`: the provider returned a not-found
 * signal (PERMANENT_NOT_FOUND), so the user is treated as already
 * deprovisioned. The saga's run-status derivation treats LIKELY_GONE as a
 * terminal-success equivalent.
 */
export type DeprovisionResultStatus = 'SUCCEEDED' | 'FAILED' | 'LIKELY_GONE';

/**
 * Classification of failure modes for retry-policy + admin-reconcile-queue UX.
 */
export type DeprovisionFailureKind =
  /** Stored token rejected by the provider — operator action required (re-OAuth). */
  | 'AUTH_REVOKED'
  /** External user id is no longer present provider-side — idempotent: treat as success. */
  | 'USER_NOT_FOUND'
  /** Provider returned 429 — QStash retry will exponentially back off. */
  | 'RATE_LIMITED'
  /** 5xx from provider — retryable. */
  | 'PROVIDER_ERROR'
  /** Network timeout / connection failure — retryable. */
  | 'NETWORK'
  /** Anything else — treated as retryable until MAX_ATTEMPTS exhausted. */
  | 'UNKNOWN';

/**
 * Standard result shape returned by `suspendAccount` and `revokeAllSessions`.
 * The two SHA-256 hashes are SOC2 evidence-grade audit fields written into
 * `DeprovisioningStep.requestSha256` / `.responseSha256`. They MUST NOT contain PII —
 * the hashing happens AFTER PII-redaction of the canonicalised payload.
 */
export interface DeprovisionResult {
  status: DeprovisionResultStatus;
  failureKind?: DeprovisionFailureKind;
  /** Sanitised, non-PII error message; truncated to <= 1024 chars by the saga. */
  errorMessage?: string;
  /** SHA-256 hex of the canonicalised request payload (PII removed first). */
  requestSha256: string;
  /** SHA-256 hex of the canonicalised response payload (PII removed first). */
  responseSha256: string;
  /** Set when the operation was a no-op because the user was already gone. */
  skipped?: boolean;
  /** Sanitised, non-PII reason for a skip / LIKELY_GONE outcome. */
  reason?: string;
  /** Closed-enum failure classification used by the reconcile queue. */
  errorClass?: ErrorClass;
  /**
   * Extra per-sub-action audit rows (e.g. GWS `revokeAllSessions` does an
   * OAuth-grant revoke + a sign-out; each gets its own SHA-256 pair). The
   * step-runner persists these as additional audit rows beyond the step's own
   * request/response hashes. Each entry's hashes are PII-free.
   */
  subActions?: Array<{
    /** Stable label, e.g. `'revoke_oauth_grants'` / `'sign_out_sessions'`. */
    kind: string;
    requestSha256: string;
    responseSha256: string;
  }>;
}

/**
 * The Deprovisionable contract.
 *
 * Adapters that implement this interface MUST be registered via
 * `registerDeprovisionableAdapter(provider, adapter)` for the saga to discover them.
 *
 * Compile-time enforcement guarantee:
 * - `class GoogleWorkspaceAdapter extends BaseAdapter implements Deprovisionable { ... }` ←
 *   if any of the three methods is missing, TypeScript rejects the class declaration.
 * - `registerDeprovisionableAdapter(provider, new GoogleWorkspaceAdapter())` ←
 *   the signature requires `BaseAdapter & Deprovisionable`. A class missing methods
 *   fails the second check too.
 * - Any Entra adapter that forgets `revokeAllSessions()` will not compile.
 */
export interface Deprovisionable {
  /**
   * Disable the user's account at the provider. Idempotent: calling on an
   * already-suspended account returns SUCCEEDED with `failureKind: USER_NOT_FOUND`-like
   * semantics (provider-specific — adapter abstracts the difference).
   */
  suspendAccount(externalUserId: string): Promise<DeprovisionResult>;

  /**
   * Revoke all active sessions / refresh tokens for the user. After this call,
   * any cached session at the provider is invalidated. Idempotent.
   */
  revokeAllSessions(externalUserId: string): Promise<DeprovisionResult>;

  /**
   * Verifies the user is in a fully-deprovisioned state at the provider.
   * Used by the integration test stub: after suspendAccount + 5 minutes
   * of mocked-clock time, `verifyDeprovisioned` returns true.
   *
   * Returning `false` does NOT itself fail the saga; it's a TEST-TIME assertion.
   * Production saga relies on `suspendAccount`'s SUCCEEDED status.
   */
  verifyDeprovisioned(externalUserId: string): Promise<boolean>;

  /**
   * Pre-flight impact preview. Makes live (cached) provider read calls to
   * describe what deprovisioning the user will affect (account status, session
   * count, OAuth grants, channel/drive ownership, …). Returns a discriminated
   * {@link ImpactPreview} narrowed on `provider`. Never mutates provider state;
   * safe to call before the admin confirms the run.
   */
  describeImpact(externalUserId: string): Promise<ImpactPreview>;
}
