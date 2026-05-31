import { createIntegrationLogger } from '@contractor-ops/logger';
import type { BaseAdapter } from './adapters/base-adapter.js';
import type { CompanyRegistryAdapter, CompanyRegistryProvider } from './types/company-registry.js';
import type { Deprovisionable } from './types/deprovisionable.js';
import type { OcrAdapter } from './types/ocr.js';
import type { IntegrationProviderAdapter } from './types/provider.js';

// ---------------------------------------------------------------------------
// Provider Adapter Registry
// ---------------------------------------------------------------------------

const log = createIntegrationLogger('registry');

const adapters = new Map<string, IntegrationProviderAdapter>();

/**
 * Registers a provider adapter in the global registry.
 * Adapters are keyed by their slug (lowercased).
 *
 * If a slug is already registered, the existing entry is overwritten and a
 * warning is logged so accidental double-registration (e.g., test leakage
 * between Vitest workers) is visible.
 *
 * @param adapter - The provider adapter to register
 */
export function registerAdapter(adapter: IntegrationProviderAdapter): void {
  const slug = adapter.slug.toLowerCase();
  if (adapters.has(slug)) {
    log.warn({ slug }, 'registerAdapter: slug already registered — overwriting existing adapter');
  }
  adapters.set(slug, adapter);
}

/**
 * Looks up a registered provider adapter by slug.
 *
 * @param slug - The provider slug to look up (case-insensitive)
 * @returns The adapter, or undefined if not registered
 */
export function getAdapter(slug: string): IntegrationProviderAdapter | undefined {
  return adapters.get(slug.toLowerCase());
}

/**
 * Returns all registered provider adapters.
 */
export function getAllAdapters(): IntegrationProviderAdapter[] {
  return Array.from(adapters.values());
}

/**
 * Clears all registered adapters. Useful for testing.
 *
 * Also clears the OCR adapter registry to keep the two registries in sync
 * for tests that expect a clean slate.
 */
export function clearAdapters(): void {
  adapters.clear();
  ocrAdapters.clear();
  companyRegistryAdapters.clear();
}

// ---------------------------------------------------------------------------
// OCR Adapter Registry
// ---------------------------------------------------------------------------
//
// OCR adapters (e.g. Claude Vision) implement only the `OcrAdapter` contract,
// not the full `IntegrationProviderAdapter` interface. They have no
// IntegrationConnection row, no OAuth flow, and no webhooks. Mixing them
// into the main provider registry would force health checks to query Prisma
// with a non-existent provider enum value.
//
// They live in their own dedicated map keyed by lowercased slug, and are
// resolved by `getOcrAdapter()` in `services/ocr-service.ts`.

const ocrAdapters = new Map<string, OcrAdapter>();

/**
 * Registers an OCR adapter in the dedicated OCR registry.
 *
 * @param adapter - The OCR adapter to register (must define `slug`)
 */
export function registerOcrAdapter(adapter: OcrAdapter & { slug: string }): void {
  const slug = adapter.slug.toLowerCase();
  if (ocrAdapters.has(slug)) {
    log.warn(
      { slug },
      'registerOcrAdapter: slug already registered — overwriting existing adapter',
    );
  }
  ocrAdapters.set(slug, adapter);
}

/**
 * Looks up an OCR adapter by slug (case-insensitive).
 */
export function getOcrAdapterBySlug(slug: string): OcrAdapter | undefined {
  return ocrAdapters.get(slug.toLowerCase());
}

/**
 * Returns all registered OCR adapters.
 */
export function getAllOcrAdapters(): OcrAdapter[] {
  return Array.from(ocrAdapters.values());
}

// ---------------------------------------------------------------------------
// Company Registry Adapter Registry
// ---------------------------------------------------------------------------
//
// Polish company-registry adapters (Dataport, GUS BIR1) implement only the
// `CompanyRegistryAdapter` contract. Like OCR adapters, they have no
// IntegrationConnection row, no OAuth, no webhooks — so they live in their
// own dedicated map keyed by lowercased slug, resolved by
// `getCompanyRegistryAdapter()` in `services/company-registry-service.ts`.

const companyRegistryAdapters = new Map<CompanyRegistryProvider, CompanyRegistryAdapter>();

/**
 * Registers a company-registry adapter.
 */
export function registerCompanyRegistryAdapter(adapter: CompanyRegistryAdapter): void {
  const slug = adapter.slug;
  if (companyRegistryAdapters.has(slug)) {
    log.warn(
      { slug },
      'registerCompanyRegistryAdapter: slug already registered — overwriting existing adapter',
    );
  }
  companyRegistryAdapters.set(slug, adapter);
}

/**
 * Looks up a registered company-registry adapter by slug.
 */
export function getCompanyRegistryAdapterBySlug(
  slug: CompanyRegistryProvider,
): CompanyRegistryAdapter | undefined {
  return companyRegistryAdapters.get(slug);
}

/**
 * Returns all registered company-registry adapters.
 */
export function getAllCompanyRegistryAdapters(): CompanyRegistryAdapter[] {
  return Array.from(companyRegistryAdapters.values());
}

// ---------------------------------------------------------------------------
// Deprovisionable Adapter Registry (Phase 76 D-13)
// ---------------------------------------------------------------------------
//
// Compile-time enforcement: only `BaseAdapter & Deprovisionable` instances pass
// the registration signature. A class that implements BaseAdapter but forgets
// any of the three Deprovisionable methods will not compile at the
// `registerDeprovisionableAdapter` call site (SC#5).
//
// DeprovisioningProviderId is a type-level union duplicated here (it mirrors the
// Prisma `DeprovisioningProvider` enum + the @contractor-ops/idp-saga union).
// The duplication is deliberate: packages/integrations cannot circularly depend
// on @contractor-ops/idp-saga, and the literals are stable.

type DeprovisioningProviderId = 'GOOGLE_WORKSPACE' | 'SLACK' | 'ENTRA' | 'OKTA' | 'GITHUB';

const deprovisionableAdapters = new Map<DeprovisioningProviderId, BaseAdapter & Deprovisionable>();

/**
 * Registers a Deprovisionable adapter for a provider. Throws on double registration.
 */
export function registerDeprovisionableAdapter(
  provider: DeprovisioningProviderId,
  adapter: BaseAdapter & Deprovisionable,
): void {
  if (deprovisionableAdapters.has(provider)) {
    throw new Error(`Deprovisionable adapter already registered for ${provider}`);
  }
  deprovisionableAdapters.set(provider, adapter);
}

/**
 * Resolves the Deprovisionable adapter for a provider. Throws if none registered.
 */
export function getDeprovisionableAdapter(
  provider: DeprovisioningProviderId,
): BaseAdapter & Deprovisionable {
  const adapter = deprovisionableAdapters.get(provider);
  if (!adapter) {
    throw new Error(`No Deprovisionable adapter registered for provider: ${provider}`);
  }
  return adapter;
}

/** Internal — for tests only. Resets the registered Deprovisionable adapters. */
export function _resetDeprovisionableAdapters(): void {
  deprovisionableAdapters.clear();
}
