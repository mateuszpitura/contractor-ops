import type { StatusReport } from '@contractor-ops/api/services/status-aggregator';
import { aggregateStatus } from '@contractor-ops/api/services/status-aggregator';
import { evaluate } from '@contractor-ops/feature-flags';
import type { Context } from 'hono';

// Short-TTL in-memory cache: a public status page is a magnet for status-check
// storms, so we serve a cached snapshot and only re-probe the health sources
// once per window. Per-instance is fine — the payload is coarse + non-tenant.
const CACHE_TTL_MS = 10_000;
let cached: { at: number; payload: StatusReport } | null = null;

/**
 * Public, UNAUTHENTICATED `/status.json`. Behind the `module.public-status-page`
 * flag (404 when off — ship-dark). Serves three coarse component states +
 * open-incident history aggregated from the shipped health sources, with NO
 * tenant data. Cached for a short window; the aggregator itself is fail-safe.
 */
export async function statusHandler(c: Context): Promise<Response> {
  // The status page is a global surface with no calling tenant; the flag is
  // global (default-off), so a synthetic context is sufficient for evaluation.
  const flag = evaluate('module.public-status-page', {
    organizationId: 'public-status-page',
    region: 'EU',
  });
  if (!flag.enabled) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'The requested endpoint does not exist.',
          status: 404,
        },
      },
      404,
    );
  }

  const now = Date.now();
  if (!cached || now - cached.at > CACHE_TTL_MS) {
    cached = { at: now, payload: await aggregateStatus() };
  }

  return c.json(cached.payload, 200);
}
