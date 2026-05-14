import { createLogger } from '@contractor-ops/logger';
import type { Context, Unleash } from 'unleash-client';
import { initialize } from 'unleash-client';
import type { Region } from './schemas';

const log = createLogger({ service: 'feature-flags' });

export type { Region } from './schemas';

/**
 * Sentinel branding so the evaluator can detect the stub client and apply
 * `killWhenUnknown` semantics — flags marked `killWhenUnknown: true` resolve
 * to `false` when Unleash is unreachable, regardless of their `default`.
 */
const STUB_CLIENT_BRAND = Symbol.for('contractor-ops.feature-flags.stub-client');

/** Re-export Unleash's Context type as our canonical eval-context shape. */
export type FlagEvalUnleashContext = Context;

/**
 * Minimal shape the evaluator depends on. The official `Unleash` class from
 * `unleash-client` satisfies this contract, as does the stub used when the
 * regional Unleash isn't configured (local dev without the docker profile) or
 * at startup before polling has completed.
 */
export interface FlagClient {
  isEnabled(name: string, context: Context, fallback: boolean): boolean;
}

/**
 * Returns true when the supplied client is the local "Unleash unreachable"
 * stub. Exposed (via internal import) so `evaluateAgainst` can apply
 * `killWhenUnknown: true` semantics to kill-switches during Unleash outages.
 */
export function isStubClient(client: FlagClient): boolean {
  return (client as unknown as { [STUB_CLIENT_BRAND]?: true })[STUB_CLIENT_BRAND] === true;
}

function createStubClient(region: Region, reason: string): FlagClient {
  log.warn(
    { region, reason },
    'feature-flags: using stub client — all flags resolve to code-declared defaults',
  );
  return {
    isEnabled: (_name, _ctx, fallback) => fallback,
    [STUB_CLIENT_BRAND]: true,
  } as FlagClient;
}

function createUnleashClient(region: Region): FlagClient {
  const url = process.env[`UNLEASH_URL_${region}`];
  const apiToken = process.env[`UNLEASH_API_TOKEN_${region}`];
  const appName = process.env.UNLEASH_APP_NAME ?? 'contractor-ops';
  const environment = process.env.UNLEASH_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';

  if (!(url && apiToken)) {
    return createStubClient(region, 'UNLEASH_URL or UNLEASH_API_TOKEN missing');
  }

  try {
    const client: Unleash = initialize({
      url,
      appName,
      environment,
      customHeaders: { Authorization: apiToken },
      refreshInterval: 15_000,
      metricsInterval: 60_000,
      disableMetrics: false,
    });

    // Track readiness so we can fully drop the expected boot-race noise.
    // The SDK emits `Unleash has not been initialized yet. isEnabled(X)
    // defaulted to Y` for every flag check that arrives in the ~100-300ms
    // window between `initialize()` and the first toggle-config fetch
    // completing. Those warnings are not actionable (we ALREADY fall back to
    // declared defaults by design) and they show up in N copies on boot —
    // one per flag the app touches at startup. The `unleash client ready`
    // info line is sufficient signal that the SDK is live. Other warns
    // (stale config, fetch failures, schema drift) still surface at warn.
    let isReady = false;
    client.on('error', err => log.error({ err, region }, 'unleash client error'));
    client.on('warn', msg => {
      if (!isReady && typeof msg === 'string' && msg.includes('has not been initialized yet')) {
        return; // drop entirely — boot-race noise has zero debug value
      }
      log.warn({ msg, region }, 'unleash client warning');
    });
    // Don't log the URL — benign today, but keeps us free of a future footgun
    // if someone ever sets UNLEASH_URL with embedded credentials.
    client.on('ready', () => {
      isReady = true;
      log.info({ region }, 'unleash client ready');
    });

    return client;
  } catch (err) {
    log.error({ err, region }, 'unleash client initialization failed — falling back to defaults');
    return createStubClient(region, 'initialization failed');
  }
}

/**
 * Singleton clients survive Next.js dev hot-reloads by anchoring the map on
 * `globalThis`. Without this, every `require.cache` invalidation would leave
 * orphaned clients still polling Unleash in the background. In production
 * (no hot reload) this is functionally identical to a module-scoped Map.
 */
type FlagClientRegistry = { __contractorOpsFlagClients?: Map<Region, FlagClient> };

const globalRegistry = globalThis as unknown as FlagClientRegistry;
if (!globalRegistry.__contractorOpsFlagClients) {
  globalRegistry.__contractorOpsFlagClients = new Map<Region, FlagClient>();
}
const clients: Map<Region, FlagClient> = globalRegistry.__contractorOpsFlagClients;

/**
 * Returns the singleton Unleash client for the given region, lazily constructing
 * it on first call. The client polls its Unleash server in the background; calls
 * made before polling completes return the `fallback` argument to `isEnabled`.
 *
 * Missing env vars or initialization failure yield a stub client that always
 * returns the fallback — graceful degradation, never throws.
 */
export function getFlagClient(region: Region): FlagClient {
  const existing = clients.get(region);
  if (existing) return existing;
  const client = createUnleashClient(region);
  clients.set(region, client);
  return client;
}

/**
 * Stops polling and releases all regional clients. Useful in tests and graceful
 * shutdown hooks.
 */
export function shutdownFlagClients(): void {
  for (const [region, client] of clients) {
    try {
      const maybeDestroy = (client as { destroy?: () => void }).destroy;
      if (typeof maybeDestroy === 'function') maybeDestroy.call(client);
    } catch (err) {
      log.warn({ err, region }, 'flag client shutdown failed');
    }
  }
  clients.clear();
}

/**
 * Test helper: inject a fake client for a given region.
 */
export function setFlagClientForTesting(region: Region, client: FlagClient | null): void {
  if (client === null) clients.delete(region);
  else clients.set(region, client);
}
