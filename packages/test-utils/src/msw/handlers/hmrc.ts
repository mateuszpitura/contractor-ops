// Phase 57 · Plan 01 — MSW handlers for HMRC VAT API (PAY-03, D-01/D-03).
//
// Covers:
//   - OAuth 2.0 client-credentials token (POST /oauth/token)
//   - VAT lookup unverified + verified (GET /organisations/vat/check-vat-number/lookup/:targetVrn/:requesterVrn?)
//   - 200 for HMRC_SANDBOX_VALID_VRN
//   - 404 for HMRC_SANDBOX_INVALID_VRN
//   - 401-refresh-then-200 when header `X-Test-Scenario: token-refresh` is set
//
// Registered for both HMRC test (sandbox) and production base URLs.

import { HttpResponse, http } from 'msw';
import {
  HMRC_OAUTH_TOKEN_200,
  HMRC_SANDBOX_INVALID_VRN,
  HMRC_SANDBOX_VALID_VRN,
  HMRC_VAT_LOOKUP_200,
  HMRC_VAT_LOOKUP_404,
  HMRC_VAT_LOOKUP_500,
} from '../fixtures/hmrc.js';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions } from '../utils.js';

const HMRC_TEST = 'https://test-api.service.hmrc.gov.uk';
const HMRC_PROD = 'https://api.service.hmrc.gov.uk';

/** Per-base-URL in-memory state for the 401-refresh scenario. */
const refreshedTokens = new Set<string>();

function hmrcEndpoints(baseUrl: string, net: HandlerOptions['network']) {
  return [
    // --- OAuth 2.0 client-credentials token ---
    http.post(`${baseUrl}/oauth/token`, async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json(HMRC_OAUTH_TOKEN_200);
    }),

    // --- Unverified lookup: single-arg (target only) ---
    http.get(
      `${baseUrl}/organisations/vat/check-vat-number/lookup/:targetVrn`,
      async ({ params, request }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;

        const targetVrn = String(params.targetVrn);
        const scenario = request.headers.get('X-Test-Scenario');

        // 401-then-refresh simulation — first call 401, subsequent 200.
        if (scenario === 'token-refresh' && !refreshedTokens.has(targetVrn)) {
          refreshedTokens.add(targetVrn);
          return HttpResponse.json(
            { code: 'INVALID_CREDENTIALS', message: 'Token expired' },
            { status: 401 },
          );
        }

        if (targetVrn === HMRC_SANDBOX_INVALID_VRN) {
          return HttpResponse.json(HMRC_VAT_LOOKUP_404, { status: 404 });
        }
        if (targetVrn === '500500500') {
          return HttpResponse.json(HMRC_VAT_LOOKUP_500, { status: 500 });
        }

        return HttpResponse.json(HMRC_VAT_LOOKUP_200(targetVrn || HMRC_SANDBOX_VALID_VRN));
      },
    ),

    // --- Verified (two-arg) lookup ---
    http.get(
      `${baseUrl}/organisations/vat/check-vat-number/lookup/:targetVrn/:requesterVrn`,
      async ({ params }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;

        const targetVrn = String(params.targetVrn);
        const requesterVrn = String(params.requesterVrn);

        if (targetVrn === HMRC_SANDBOX_INVALID_VRN) {
          return HttpResponse.json(HMRC_VAT_LOOKUP_404, { status: 404 });
        }

        return HttpResponse.json(HMRC_VAT_LOOKUP_200(targetVrn, requesterVrn));
      },
    ),
  ];
}

export function hmrcHandlers(options?: HandlerOptions) {
  const net = options?.network;
  return [...hmrcEndpoints(HMRC_TEST, net), ...hmrcEndpoints(HMRC_PROD, net)];
}

/** Test-helper: clear the in-memory refresh ledger between tests. */
export function clearHmrcTokenRefreshLedger() {
  refreshedTokens.clear();
}
