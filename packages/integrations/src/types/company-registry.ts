// ---------------------------------------------------------------------------
// Company Registry Adapter Contract
// ---------------------------------------------------------------------------
//
// Port for fetching Polish company data from external registries by NIP. The
// concrete adapters (`DataportCompanyRegistryAdapter`, `Bir1CompanyRegistryAdapter`)
// are interchangeable behind this interface so the active provider can be
// swapped via env var without touching call-sites.

/**
 * Supported company-registry providers.
 *
 * - `dataport` — REST/JSON, free 10 req/day, used in dev.
 * - `bir1`     — GUS BIR1 SOAP service (via the `bir1` npm package), prod.
 */
export type CompanyRegistryProvider = 'dataport' | 'bir1';

export interface CompanyLookupRequest {
  /** 10-digit Polish NIP, already cleaned (no spaces / hyphens). */
  nip: string;
}

export interface CompanyLookupResult {
  /** False when the registry returned no entity for the given NIP. */
  found: boolean;
  legalName?: string;
  regon?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2 — always 'PL' for both current providers. */
  countryCode?: string;
  /** Adapter slug that produced this result, useful for log correlation. */
  rawProvider?: CompanyRegistryProvider;
}

export interface CompanyRegistryAdapter {
  /** Human-readable provider name for logs / errors. */
  readonly providerName: string;
  /** Stable identifier used by the registry. Lowercased. */
  readonly slug: CompanyRegistryProvider;
  /** Look up a company by its 10-digit Polish NIP. */
  lookupByNip(req: CompanyLookupRequest): Promise<CompanyLookupResult>;
}
