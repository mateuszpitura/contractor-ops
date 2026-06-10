// Shared DeprovisionResult builder for the IdP deprovision adapters.
//
// ALL five Deprovisionable adapters (GWS, Slack, Entra, Okta, GitHub) share an
// identical classify-then-branch pattern:
//   1. TRANSIENT_* → throw so the QStash step-runner retries with backoff.
//   2. PERMANENT_NOT_FOUND → LIKELY_GONE (idempotent; user already gone).
//   3. Anything else → FAILED with AUTH_REVOKED or PROVIDER_ERROR kind.
//
// Previously each adapter duplicated ~30 lines of this logic in a private method.
// This pure helper centralises the contract so a future change to DeprovisionResult
// or the TRANSIENT-retry contract is made in one place and picked up by all adapters.
//
// DESIGN NOTE: this is a FREE FUNCTION, not a base-class method. `BaseAdapter` has
// no Deprovisionable knowledge and we avoid using inheritance as a DRY mechanism.

import type { DeprovisionResult } from '../types/deprovisionable.js';
import type { ErrorClass } from './error-classifier.js';

/**
 * Map a pre-classified {@link ErrorClass} to a {@link DeprovisionResult}.
 *
 * The caller is responsible for computing `errorClass` via {@link classifyError}
 * (or an adapter-specific pre-classification like Slack's `#classifySlackError`)
 * BEFORE calling this helper.
 *
 * @param errorClass  - closed-enum classification of the failure
 * @param requestSha256  - SHA-256 of the canonicalised request payload
 * @param responseSha256 - SHA-256 of the canonicalised response payload
 * @param notFoundReason - sanitised reason string for LIKELY_GONE outcomes
 *                         (e.g. `'user_not_found'`, `'not_a_member'`)
 * @param transientDetail - included in the thrown error message for TRANSIENT_*
 *                          (e.g. `'429/TRANSIENT_RATE_LIMIT'`)
 * @param failedDetail    - included in the errorMessage for FAILED results
 *                          (e.g. `'entra deprovision failed (403/PERMANENT_FORBIDDEN)'`)
 *
 * @throws {Error} when `errorClass` is `TRANSIENT_RATE_LIMIT` or `TRANSIENT_NETWORK` —
 *   the caller (QStash step-runner) must propagate this to retry the job.
 */
export function mapErrorClassToResult(
  errorClass: ErrorClass,
  opts: {
    requestSha256: string;
    responseSha256: string;
    notFoundReason: string;
    transientDetail: string;
    failedDetail: string;
  },
): DeprovisionResult {
  const { requestSha256, responseSha256, notFoundReason, transientDetail, failedDetail } = opts;

  if (errorClass === 'TRANSIENT_RATE_LIMIT' || errorClass === 'TRANSIENT_NETWORK') {
    throw new Error(`${transientDetail} (${errorClass})`);
  }
  if (errorClass === 'PERMANENT_NOT_FOUND') {
    return {
      status: 'LIKELY_GONE',
      skipped: false,
      reason: notFoundReason,
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
    errorMessage: failedDetail,
    requestSha256,
    responseSha256,
  };
}
