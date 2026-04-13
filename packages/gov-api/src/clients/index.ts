// Phase 57 · Plan 02 — Gov-API client barrel exports.
//
// Downstream (Plan 57-03 orchestrator) imports both clients from
// `@contractor-ops/gov-api`.

export {
  HmrcApiError,
  HmrcVatClient,
  type HmrcVatClientDeps,
  type HmrcVatLookupResult,
} from './hmrc-vat-client.js';
// ViesClient barrel entries appended in Task 2.
