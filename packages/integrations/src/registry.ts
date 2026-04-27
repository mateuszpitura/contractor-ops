import { createIntegrationLogger } from '@contractor-ops/logger';
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
