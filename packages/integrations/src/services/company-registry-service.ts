import { createIntegrationLogger } from '@contractor-ops/logger';
import { getCompanyRegistryAdapterBySlug } from '../registry.js';
import type {
  CompanyLookupResult,
  CompanyRegistryAdapter,
  CompanyRegistryProvider,
} from '../types/company-registry.js';

// ---------------------------------------------------------------------------
// Provider-Agnostic Company Registry Service
// ---------------------------------------------------------------------------
//
// Resolves the active `CompanyRegistryAdapter` (env-var driven), wraps the
// lookup in a single network-error-aware retry, and normalises terminal
// failures to `{ found: false }` so call-sites get a stable shape.

const log = createIntegrationLogger('company-registry');

const DEFAULT_PROVIDER: CompanyRegistryProvider = 'dataport';
const VALID_PROVIDERS: ReadonlySet<CompanyRegistryProvider> = new Set(['dataport', 'bir1']);
const RETRY_DELAY_MS = 2_000;
const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

export interface LookupCompanyOptions {
  provider?: CompanyRegistryProvider;
}

/**
 * Resolves the configured company-registry provider.
 *
 * Priority: explicit option → `COMPANY_REGISTRY_PROVIDER` env var → default.
 * Unknown env values fall back to the default and emit a warning so a typo
 * never silently disables the lookup.
 */
export function resolveCompanyRegistryProvider(
  override?: CompanyRegistryProvider,
): CompanyRegistryProvider {
  if (override) return override;

  const fromEnv = process.env.COMPANY_REGISTRY_PROVIDER?.trim().toLowerCase();
  if (!fromEnv) return DEFAULT_PROVIDER;

  if (VALID_PROVIDERS.has(fromEnv as CompanyRegistryProvider)) {
    return fromEnv as CompanyRegistryProvider;
  }

  log.warn(
    { value: fromEnv, fallback: DEFAULT_PROVIDER },
    'resolveCompanyRegistryProvider: unknown COMPANY_REGISTRY_PROVIDER value — falling back to default',
  );
  return DEFAULT_PROVIDER;
}

/**
 * Returns the registered adapter for the given (or env-configured) provider.
 *
 * @throws Error if the adapter is not registered. Caller must have invoked
 *   `registerAllAdapters()` (and `loadHeavyAdapters()` for `bir1`).
 */
export function getCompanyRegistryAdapter(
  provider?: CompanyRegistryProvider,
): CompanyRegistryAdapter {
  const slug = resolveCompanyRegistryProvider(provider);
  const adapter = getCompanyRegistryAdapterBySlug(slug);
  if (!adapter) {
    throw new Error(
      `No adapter registered for company-registry provider: ${slug}. ` +
        `Ensure registerAllAdapters() (and loadHeavyAdapters() for bir1) ran.`,
    );
  }
  return adapter;
}

/**
 * Looks up a Polish company by NIP. Always resolves to a `CompanyLookupResult`:
 * terminal errors are logged and normalised to `{ found: false }` so callers
 * (the tRPC router) can map the result onto a stable response shape.
 *
 * Mirrors the previous inline retry-once-on-network-error semantics that lived
 * in the `companyLookup` tRPC query (formerly `gusLookup`).
 */
export async function lookupCompanyByNip(
  nip: string,
  opts: LookupCompanyOptions = {},
): Promise<CompanyLookupResult> {
  const adapter = getCompanyRegistryAdapter(opts.provider);

  try {
    return await adapter.lookupByNip({ nip });
  } catch (err) {
    if (isNetworkError(err)) {
      log.info(
        { provider: adapter.slug, err: serialiseError(err) },
        'company-registry: network error, retrying once',
      );
      await delay(RETRY_DELAY_MS);
      try {
        return await adapter.lookupByNip({ nip });
      } catch (retryErr) {
        log.warn(
          { provider: adapter.slug, err: serialiseError(retryErr) },
          'company-registry: lookup failed after retry',
        );
        return { found: false, rawProvider: adapter.slug };
      }
    }

    log.warn(
      { provider: adapter.slug, err: serialiseError(err) },
      'company-registry: lookup failed',
    );
    return { found: false, rawProvider: adapter.slug };
  }
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  if (code && NETWORK_ERROR_CODES.has(code)) return true;
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return true;
  if (err.name === 'FetchError') return true;
  if (err.message.includes('fetch failed') || err.message.includes('network')) return true;
  return false;
}

function serialiseError(err: unknown): { name?: string; message?: string; code?: string } {
  if (!(err instanceof Error)) return { message: String(err) };
  return {
    name: err.name,
    message: err.message,
    code: (err as Error & { code?: string }).code,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Re-export contract types for consumer convenience.
export type {
  CompanyLookupRequest,
  CompanyLookupResult,
  CompanyRegistryAdapter,
  CompanyRegistryProvider,
} from '../types/company-registry.js';
