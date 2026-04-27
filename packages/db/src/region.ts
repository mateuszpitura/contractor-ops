import { createPrismaClientForUrl } from './client.js';
import type { PrismaClient } from './generated/prisma/client/client.js';

// ---------------------------------------------------------------------------
// Supported Regions
// ---------------------------------------------------------------------------

export const SUPPORTED_REGIONS = ['EU', 'ME'] as const;
export type DataRegion = (typeof SUPPORTED_REGIONS)[number];

// ---------------------------------------------------------------------------
// Region → env var mapping
// ---------------------------------------------------------------------------

const REGION_ENV_MAP: Record<DataRegion, string> = {
  EU: 'DATABASE_URL_EU',
  ME: 'DATABASE_URL_ME',
};

// ---------------------------------------------------------------------------
// Regional client pool (cached on globalThis for HMR safety)
// ---------------------------------------------------------------------------

const globalForRegions = globalThis as unknown as {
  regionalClients: Map<DataRegion, PrismaClient> | undefined;
};

function getClientPool(): Map<DataRegion, PrismaClient> {
  if (!globalForRegions.regionalClients) {
    globalForRegions.regionalClients = new Map();
  }
  return globalForRegions.regionalClients;
}

/**
 * Returns a cached PrismaClient for the given data region.
 * Creates one on first access using the region's DATABASE_URL_* env var.
 *
 * @throws If region is not in SUPPORTED_REGIONS
 * @throws If the corresponding env var is not set
 */
export function getRegionalClient(region: string): PrismaClient {
  if (!SUPPORTED_REGIONS.includes(region as DataRegion)) {
    throw new Error(
      `Unsupported data region: ${region}. Supported: ${SUPPORTED_REGIONS.join(', ')}`,
    );
  }

  const typedRegion = region as DataRegion;
  const pool = getClientPool();
  const cached = pool.get(typedRegion);
  if (cached) return cached;

  const envVar = REGION_ENV_MAP[typedRegion];
  const connectionString = process.env[envVar];
  if (!connectionString) {
    throw new Error(`${envVar} environment variable is not set for region ${typedRegion}`);
  }

  const client = createPrismaClientForUrl(connectionString);
  pool.set(typedRegion, client);
  return client;
}

/**
 * Pre-warms regional clients at server startup.
 * Silently skips regions whose env vars are not configured.
 */
export function preWarmRegionalClients(): void {
  for (const region of SUPPORTED_REGIONS) {
    try {
      getRegionalClient(region);
    } catch {
      /* skip regions without configured env vars */
    }
  }
}
