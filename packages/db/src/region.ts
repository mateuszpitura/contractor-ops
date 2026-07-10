import { createPrismaClientForUrl } from './client.js';
import type { PrismaClient } from './generated/prisma/client/client.js';

// ---------------------------------------------------------------------------
// Supported Regions
// ---------------------------------------------------------------------------

export const SUPPORTED_REGIONS = ['EU', 'ME', 'US'] as const;
export type DataRegion = (typeof SUPPORTED_REGIONS)[number];

// ---------------------------------------------------------------------------
// Region → env var mapping
// ---------------------------------------------------------------------------

const REGION_ENV_MAP: Record<DataRegion, string> = {
  EU: 'DATABASE_URL_EU',
  ME: 'DATABASE_URL_ME',
  // US is OPTIONAL (DATABASE_URL_US unset locally): getRegionalClient stays
  // recognized for 'US' but lazy-throws the missing-env error on actual access.
  US: 'DATABASE_URL_US',
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

/**
 * Returns a regional client, or null when the region's DATABASE_URL_* is unset.
 * Used by cron/QStash fan-outs that must skip unconfigured regions without aborting.
 */
export function tryGetRegionalClient(region: DataRegion): PrismaClient | null {
  try {
    return getRegionalClient(region);
  } catch {
    return null;
  }
}

export interface RegionalFindResult<T> {
  result: T;
  region: DataRegion;
  client: PrismaClient;
}

/**
 * Scans configured regions until `finder` returns a non-null value. Used by
 * QStash/cron routes that carry an id but no tenant frame to locate which
 * regional DB owns the row.
 */
export async function findAcrossRegions<T>(
  finder: (client: PrismaClient, region: DataRegion) => Promise<T | null | undefined>,
): Promise<RegionalFindResult<T> | null> {
  for (const region of SUPPORTED_REGIONS) {
    const client = tryGetRegionalClient(region);
    if (!client) continue;
    const result = await finder(client, region);
    if (result != null) return { result, region, client };
  }
  return null;
}

/**
 * Locates an organization's home region by scanning configured regional DBs.
 */
export async function resolveOrganizationRegion(
  organizationId: string,
): Promise<RegionalFindResult<DataRegion> | null> {
  const found = await findAcrossRegions(async client => {
    const org = await client.organization.findUnique({
      where: { id: organizationId },
      select: { dataRegion: true },
    });
    if (!org) return null;
    return (org.dataRegion ?? 'EU') as DataRegion;
  });
  if (!found) return null;
  return { result: found.result, region: found.region, client: found.client };
}
