// Shared, I/O-free contracts for the HRIS two-way sync engine.
//
// The provider wire shapes (HrisEmployeeRecord, HrisPushPayload, HrisProvider)
// live in the integrations layer — the api package depends on integrations, not
// the reverse — and are re-exported here so the hris-sync services import them
// from one place. The mapping + snapshot-diff state are api-domain concepts and
// stay local.

export {
  HRIS_PROVIDERS,
  type HrisEmployeeRecord,
  type HrisProvider,
  type HrisPushInput,
  type HrisPushPayload,
} from '@contractor-ops/integrations';

/**
 * The org's field mapping, persisted in `IntegrationConnection.configJson`.
 * `standard` maps each writable target key to the HRIS attribute name that
 * feeds it; `customAttributes` maps an HRIS custom-attribute key to a
 * `countryFields` key (BambooHR custom-attr path is contract-gated).
 */
export interface HrisFieldMapping {
  standard: {
    displayName?: string;
    email?: string;
    position?: string;
    department?: string;
    employmentStatus?: string;
    hireDate?: string;
    terminatedAt?: string;
  };
  customAttributes?: Record<string, string>;
}

/**
 * Snapshot-diff state, persisted alongside the mapping in `configJson`. The
 * pull reads `lastSuccessfulSyncAt` as its delta cursor (Personio) and diffs
 * each record's `syncHash` against `hashes` (BambooHR un-paginated snapshot).
 */
export interface HrisSyncState {
  lastSuccessfulSyncAt?: string;
  hashes?: Record<string, string>;
}
