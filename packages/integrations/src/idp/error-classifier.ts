// Phase 77 D-07 / D-08 — closed-enum IdP error classifier.
//
// PURE function consumed by the GWS + Slack deprovision adapters (77-02/03) and
// the QStash step-runner (77-04) to set `DeprovisioningStep.errorClass`. It
// coexists with Phase 76's `DeprovisionFailureKind` (retry-policy hints): this
// classifier is the closed-enum taxonomy that drives the admin reconcile-queue
// UX + the LIKELY_GONE/manual-override flow, derived purely from HTTP status +
// provider error code. No side effects, no logging, no network/db imports.

/**
 * Closed taxonomy of deprovision call-failure modes (CONTEXT.md D-07).
 *
 * - `TRANSIENT_*` — retryable; the step runner re-enqueues with backoff.
 * - `PERMANENT_NOT_FOUND` — the user is already gone provider-side → the saga
 *   treats this as LIKELY_GONE (idempotent success), not a hard failure.
 * - `PERMANENT_AUTH_EXPIRED` — stored token rejected → operator must re-OAuth.
 * - `PERMANENT_FORBIDDEN` — caller lacks the privilege (or Slack
 *   `cannot_perform_operation`) → surfaces the manual-override affordance.
 * - `PERMANENT_OTHER` — any other non-retryable failure.
 */
export type ErrorClass =
  | 'TRANSIENT_RATE_LIMIT'
  | 'TRANSIENT_NETWORK'
  | 'PERMANENT_NOT_FOUND'
  | 'PERMANENT_AUTH_EXPIRED'
  | 'PERMANENT_FORBIDDEN'
  | 'PERMANENT_OTHER';

/**
 * Input to {@link classifyError}. All fields optional so a bare `{}` (no
 * diagnostic signal at all) classifies to `PERMANENT_OTHER`.
 */
export interface ClassifyErrorInput {
  /** HTTP status code from the provider response, if any. */
  httpStatus?: number;
  /**
   * Provider-specific machine error code (e.g. Slack `cannot_perform_operation`,
   * Google `insufficientPermissions`). Case-insensitive matching.
   */
  providerErrorCode?: string;
  /**
   * The thrown cause (Error, DOMException, fetch failure, etc.). Inspected for
   * network-level signals (ECONNRESET, ETIMEDOUT, "fetch failed").
   */
  cause?: unknown;
}

const FORBIDDEN_PROVIDER_CODES = new Set([
  'forbidden',
  'insufficientpermissions',
  'insufficient_permissions',
  'cannot_perform_operation',
]);

const NETWORK_ERROR_TOKENS = [
  'econnreset',
  'etimedout',
  'econnrefused',
  'enotfound',
  'fetch failed',
];

function isNetworkCause(cause: unknown): boolean {
  if (cause == null) return false;
  // Node fetch wraps the underlying network error in `cause`; unwrap one level.
  const candidates: unknown[] = [cause];
  if (typeof cause === 'object' && 'cause' in cause) {
    candidates.push((cause as { cause: unknown }).cause);
  }
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const code =
      typeof candidate === 'object' && 'code' in candidate
        ? String((candidate as { code: unknown }).code)
        : '';
    const message =
      candidate instanceof Error
        ? candidate.message
        : typeof candidate === 'string'
          ? candidate
          : '';
    const haystack = `${code} ${message}`.toLowerCase();
    if (NETWORK_ERROR_TOKENS.some(token => haystack.includes(token))) return true;
  }
  return false;
}

/**
 * Maps an HTTP status + optional provider error code into the closed
 * {@link ErrorClass} taxonomy (CONTEXT.md D-07 / D-08).
 *
 * Precedence:
 *  1. 429 / 503 → `TRANSIENT_RATE_LIMIT`
 *  2. Network-level cause (ECONNRESET / ETIMEDOUT / fetch failure) → `TRANSIENT_NETWORK`
 *  3. 404 → `PERMANENT_NOT_FOUND`
 *  4. 401 → `PERMANENT_AUTH_EXPIRED`
 *  5. 403, or any status with a known forbidden provider code → `PERMANENT_FORBIDDEN`
 *  6. everything else → `PERMANENT_OTHER`
 */
export function classifyError(input: ClassifyErrorInput): ErrorClass {
  const { httpStatus, providerErrorCode, cause } = input;
  const code = providerErrorCode?.trim().toLowerCase();

  if (httpStatus === 429 || httpStatus === 503) return 'TRANSIENT_RATE_LIMIT';
  if (isNetworkCause(cause)) return 'TRANSIENT_NETWORK';
  if (httpStatus === 404) return 'PERMANENT_NOT_FOUND';
  if (httpStatus === 401) return 'PERMANENT_AUTH_EXPIRED';
  if (httpStatus === 403 || (code !== undefined && FORBIDDEN_PROVIDER_CODES.has(code))) {
    return 'PERMANENT_FORBIDDEN';
  }
  return 'PERMANENT_OTHER';
}
