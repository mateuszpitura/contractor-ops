import type { IntegrationProviderAdapter } from "./types/provider.js";

// ---------------------------------------------------------------------------
// Provider Adapter Registry
// ---------------------------------------------------------------------------

const adapters = new Map<string, IntegrationProviderAdapter>();

/**
 * Registers a provider adapter in the global registry.
 * Adapters are keyed by their slug (lowercased).
 *
 * @param adapter - The provider adapter to register
 */
export function registerAdapter(adapter: IntegrationProviderAdapter): void {
  adapters.set(adapter.slug.toLowerCase(), adapter);
}

/**
 * Looks up a registered provider adapter by slug.
 *
 * @param slug - The provider slug to look up (case-insensitive)
 * @returns The adapter, or undefined if not registered
 */
export function getAdapter(
  slug: string,
): IntegrationProviderAdapter | undefined {
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
 */
export function clearAdapters(): void {
  adapters.clear();
}
