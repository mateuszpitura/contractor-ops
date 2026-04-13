// Phase 57 · Plan 02 — Gov-API client barrel exports.
//
// Downstream (Plan 57-03 orchestrator) imports both clients from
// `@contractor-ops/gov-api`.

// biome-ignore lint/performance/noBarrelFile: package entry point for gov-api clients
export {
  HmrcApiError,
  HmrcVatClient,
  type HmrcVatClientDeps,
  type HmrcVatLookupResult,
} from './hmrc-vat-client.js';
export {
  ViesApiError,
  ViesClient,
  type ViesClientDeps,
  type ViesLookupResult,
} from './vies-client.js';
