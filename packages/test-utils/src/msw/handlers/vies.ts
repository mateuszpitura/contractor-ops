// MSW handlers for VIES REST API.
//
// Covers:
//   - Simple confirmation (no requesterMemberStateCode) → VIES_SIMPLE_VALID_200
//   - Qualified confirmation (with requesterMemberStateCode + requesterNumber)
//     → VIES_QUALIFIED_200 (includes requestIdentifier = consultationNumber)
//   - Special sentinel VRN `MS_UNAVAILABLE` → VIES_MS_UNAVAILABLE soft-fail branch
//
// Endpoint pattern:
//   GET https://ec.europa.eu/taxation_customs/vies/rest-api/ms/:ms/vat/:vrn
//     ?requesterMemberStateCode={ms}&requesterNumber={vrn}

import { HttpResponse, http } from 'msw';
import {
  VIES_INVALID_200,
  VIES_MS_UNAVAILABLE,
  VIES_QUALIFIED_200,
  VIES_SIMPLE_VALID_200,
} from '../fixtures/vies.js';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions } from '../utils.js';

const VIES_BASE = 'https://ec.europa.eu/taxation_customs/vies/rest-api';

export function viesHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    http.get(`${VIES_BASE}/ms/:ms/vat/:vrn`, async ({ params, request }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;

      const ms = String(params.ms);
      const vrn = String(params.vrn);

      // Sentinel: path contains `MS_UNAVAILABLE` triggers the soft-fail body.
      if (vrn === 'MS_UNAVAILABLE') {
        return HttpResponse.json(VIES_MS_UNAVAILABLE(ms, vrn));
      }
      if (vrn === 'INVALID') {
        return HttpResponse.json(VIES_INVALID_200(ms, vrn));
      }

      const url = new URL(request.url);
      const requesterMs = url.searchParams.get('requesterMemberStateCode');
      const requesterNumber = url.searchParams.get('requesterNumber');

      if (requesterMs && requesterNumber) {
        return HttpResponse.json(VIES_QUALIFIED_200(ms, vrn));
      }
      return HttpResponse.json(VIES_SIMPLE_VALID_200(ms, vrn));
    }),
  ];
}
