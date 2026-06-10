// Closed-enum IdP error classifier.
//
// PURE function consumed by the GWS + Slack deprovision adapters and the
// QStash step-runner to set `DeprovisioningStep.errorClass`. It coexists with
// `DeprovisionFailureKind` (retry-policy hints): this classifier is the
// closed-enum taxonomy that drives the admin reconcile-queue UX and the
// LIKELY_GONE/manual-override flow, derived purely from HTTP status + provider
// error code. No side effects, no logging, no network/db imports.

/**
 * Closed taxonomy of deprovision call-failure modes.
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
 * Optional provider hint for {@link classifyError}. Behavior is signal-driven,
 * not provider-driven — the hint only documents the caller's source.
 *
 * NOTE: the GoogleWorkspace/Slack/Okta/GitHub keys mirror the Prisma
 * `DeprovisioningProvider` enum; Entra is the saga key `ENTRA`. The whole
 * tree standardised on `ENTRA` (not `ENTRA_ID`); call sites must pass
 * `'ENTRA'`.
 */
export type ClassifyErrorProvider = 'GOOGLE_WORKSPACE' | 'SLACK' | 'ENTRA' | 'OKTA' | 'GITHUB';

/**
 * Input to {@link classifyError}. All fields optional so a bare `{}` (no
 * diagnostic signal at all) classifies to `PERMANENT_OTHER`.
 */
export interface ClassifyErrorInput {
  /** HTTP status code from the provider response, if any. */
  httpStatus?: number;
  /**
   * Provider-specific machine error code (e.g. Slack `cannot_perform_operation`,
   * Google `insufficientPermissions`, Entra `Authorization_RequestDenied`,
   * GitHub `require_two_factor_authentication`). Case-insensitive matching.
   */
  providerErrorCode?: string;
  /**
   * The thrown cause (Error, DOMException, fetch failure, etc.). Inspected for
   * network-level signals (ECONNRESET, ETIMEDOUT, "fetch failed").
   */
  cause?: unknown;
  /** Optional provider source hint. Behavior stays signal-driven. */
  provider?: ClassifyErrorProvider;
  /**
   * Response headers, lower-cased keys. GitHub overloads 403 for BOTH true
   * auth-forbidden AND secondary rate limits, so the headers disambiguate —
   * `x-ratelimit-remaining: 0` or a `retry-after` header on a 403 marks a
   * rate limit (TRANSIENT), not a forbidden (PERMANENT).
   */
  responseHeaders?: Record<string, string | undefined>;
  /** Raw response body text, scanned for the `secondary rate limit` marker (GitHub). */
  responseBody?: string;
}

// Entra `Authorization_RequestDenied` (missing app permission) and GitHub
// `require_two_factor_authentication` are non-retryable forbidden outcomes —
// mapped to PERMANENT_FORBIDDEN, never retried.
const FORBIDDEN_PROVIDER_CODES = new Set([
  'forbidden',
  'insufficientpermissions',
  'insufficient_permissions',
  'cannot_perform_operation',
  'authorization_requestdenied',
  'require_two_factor_authentication',
]);

/**
 * GitHub secondary-rate-limit detection on a 403.
 *
 * GitHub returns HTTP 403 for BOTH true auth-forbidden AND rate limits. A 403
 * with `x-ratelimit-remaining: 0`, a `retry-after` header, or a `secondary rate
 * limit` body marker is retryable (TRANSIENT_RATE_LIMIT); a plain 403 is a
 * PERMANENT_FORBIDDEN. Misclassifying wastes retry budget or gives up early.
 */
function isRateLimitedForbidden(input: ClassifyErrorInput): boolean {
  const headers = input.responseHeaders;
  if (headers) {
    const remaining = headers['x-ratelimit-remaining'];
    if (remaining !== undefined && remaining.trim() === '0') return true;
    if (headers['retry-after'] !== undefined && headers['retry-after'].trim() !== '') return true;
  }
  if (input.responseBody && input.responseBody.toLowerCase().includes('secondary rate limit')) {
    return true;
  }
  return false;
}

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
 * {@link ErrorClass} taxonomy.
 *
 * Precedence:
 *  1. 429 / 503 → `TRANSIENT_RATE_LIMIT`
 *  2. Network-level cause (ECONNRESET / ETIMEDOUT / fetch failure) → `TRANSIENT_NETWORK`
 *  3. 403 + rate-limit signal (GitHub secondary limit) → `TRANSIENT_RATE_LIMIT`
 *  4. 404 → `PERMANENT_NOT_FOUND`
 *  5. 401 → `PERMANENT_AUTH_EXPIRED`
 *  6. 403, or any status with a known forbidden provider code → `PERMANENT_FORBIDDEN`
 *  7. everything else → `PERMANENT_OTHER`
 *
 * Entra, Okta, and GitHub all flow through this same signal-driven logic:
 * generic 401/403/404/429 mappings come for free; the GitHub
 * 403-vs-rate-limit overload is the one provider-specific disambiguation,
 * handled by the rate-limit-signal check above the 403 branch.
 */
export function classifyError(input: ClassifyErrorInput): ErrorClass {
  const { httpStatus, providerErrorCode, cause } = input;
  const code = providerErrorCode?.trim().toLowerCase();

  if (httpStatus === 429 || httpStatus === 503) return 'TRANSIENT_RATE_LIMIT';
  if (isNetworkCause(cause)) return 'TRANSIENT_NETWORK';
  // GitHub overloads 403 for secondary rate limits — must beat the forbidden branch.
  if (httpStatus === 403 && isRateLimitedForbidden(input)) return 'TRANSIENT_RATE_LIMIT';
  if (httpStatus === 404) return 'PERMANENT_NOT_FOUND';
  if (httpStatus === 401) return 'PERMANENT_AUTH_EXPIRED';
  if (httpStatus === 403 || (code !== undefined && FORBIDDEN_PROVIDER_CODES.has(code))) {
    return 'PERMANENT_FORBIDDEN';
  }
  return 'PERMANENT_OTHER';
}
