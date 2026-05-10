import { prisma } from '@contractor-ops/db';
import { getAllAdapters } from '../registry.js';
import type { ProviderHealthStatus } from '../types/health.js';
import { getBreakerSnapshots } from './resilience.js';

// ---------------------------------------------------------------------------
// Health Service — aggregates provider connection health from multiple sources
// ---------------------------------------------------------------------------

/**
 * Retrieves the health status for a single provider connection.
 * Aggregates data from IntegrationConnection, IntegrationSyncLog,
 * and WebhookDelivery to build a complete health snapshot.
 *
 * @param organizationId - The organization to check
 * @param providerSlug - The provider slug (e.g., "slack", "jira")
 * @returns Full health status including recent syncs, webhooks, and error counts
 */
export async function getProviderHealth(
  organizationId: string,
  providerSlug: string,
): Promise<ProviderHealthStatus> {
  const providerEnum = providerSlug.toUpperCase() as Parameters<
    typeof prisma.integrationConnection.findFirst
  >[0] extends { where?: { provider?: infer P } }
    ? P
    : never;

  const connection = await prisma.integrationConnection.findFirst({
    where: { organizationId, provider: providerEnum },
    include: { connectedBy: { select: { id: true, name: true } } },
  });

  if (!connection) {
    return {
      status: 'DISCONNECTED',
      provider: providerSlug,
      displayName: null,
      connectedAt: null,
      lastSyncAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      tokenExpiresAt: null,
      recentSyncs: [],
      recentWebhooks: [],
      errorCountLast24h: 0,
    };
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [recentSyncs, recentWebhooks, errorCount] = await Promise.all([
    prisma.integrationSyncLog.findMany({
      where: { integrationConnectionId: connection.id },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        syncType: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    }),
    prisma.webhookDelivery.findMany({
      where: { organizationId, provider: providerEnum },
      orderBy: { receivedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        eventType: true,
        deliveryStatus: true,
        receivedAt: true,
        processedAt: true,
      },
    }),
    prisma.integrationSyncLog.count({
      where: {
        integrationConnectionId: connection.id,
        status: 'FAILED',
        startedAt: { gte: twentyFourHoursAgo },
      },
    }),
  ]);

  return {
    status: connection.status as ProviderHealthStatus['status'],
    provider: providerSlug,
    displayName: connection.displayName,
    connectedAt: connection.connectedAt,
    lastSyncAt: connection.lastSyncAt,
    lastSuccessAt: connection.lastSuccessAt,
    lastErrorAt: connection.lastErrorAt,
    lastErrorMessage: connection.lastErrorMessage,
    tokenExpiresAt: connection.tokenExpiresAt,
    recentSyncs,
    recentWebhooks,
    errorCountLast24h: errorCount,
  };
}

/**
 * Retrieves health status for all registered provider adapters.
 * Returns one ProviderHealthStatus per adapter, even if disconnected.
 *
 * @param organizationId - The organization to check
 * @returns Array of health statuses for all registered providers
 */
export async function getAllProviderHealth(
  organizationId: string,
): Promise<ProviderHealthStatus[]> {
  const adapters = getAllAdapters();
  return Promise.all(adapters.map(a => getProviderHealth(organizationId, a.slug)));
}

// ---------------------------------------------------------------------------
// F-INT-23 — Process-level dependency health
// ---------------------------------------------------------------------------
//
// `getProviderHealth` / `getAllProviderHealth` answer "is *this org's*
// integration connection healthy from a DB-state perspective". They do NOT
// answer "is the integrations layer as a whole degraded right now" — for
// that we need per-process signals like circuit-breaker state and a quick
// liveness probe of every infrastructural dependency the app cannot
// operate without (DB, Redis, QStash, R2, ClamAV).
//
// The /api/health route (P2-E) already runs its own probes for DB / Redis /
// QStash / R2; this helper centralises the surface so the route can adopt
// it incrementally and so external callers (admin dashboards, status
// pages) can pull a single structured snapshot.

export type DependencyHealthStatus = 'OK' | 'DEGRADED' | 'FAIL' | 'SKIPPED';

export interface DependencyProbe {
  name: 'database' | 'redis' | 'qstash' | 'r2' | 'clamav' | 'integrations';
  status: DependencyHealthStatus;
  /** Wall-clock duration of the probe in ms. 0 if skipped. */
  durationMs: number;
  /** Failure / degraded reason. Populated for FAIL and DEGRADED only. */
  reason?: string;
  /** Optional structured detail surfaced for the integrations probe. */
  details?: Record<string, unknown>;
}

export interface DependencyHealthSnapshot {
  status: DependencyHealthStatus;
  probes: DependencyProbe[];
  timestamp: string;
}

/** Per-probe wall-clock budget. Conservative — health probes run frequently. */
const PROBE_TIMEOUT_MS = 1_500;

async function withProbeTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function probeDatabase(): Promise<DependencyProbe> {
  const start = Date.now();
  try {
    // safe-raw-sql: database liveness probe — `SELECT 1` has no tenant dimension.
    await withProbeTimeout(
      prisma.$queryRaw`SELECT 1` as Promise<unknown>,
      PROBE_TIMEOUT_MS,
      'database',
    );
    return { name: 'database', status: 'OK', durationMs: Date.now() - start };
  } catch (err) {
    return {
      name: 'database',
      status: 'FAIL',
      durationMs: Date.now() - start,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeRedis(): Promise<DependencyProbe> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!(url && token)) {
    return { name: 'redis', status: 'SKIPPED', durationMs: 0 };
  }
  const start = Date.now();
  try {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({ url, token });
    await withProbeTimeout(redis.ping() as Promise<unknown>, PROBE_TIMEOUT_MS, 'redis');
    return { name: 'redis', status: 'OK', durationMs: Date.now() - start };
  } catch (err) {
    return {
      name: 'redis',
      status: 'FAIL',
      durationMs: Date.now() - start,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeQStash(): Promise<DependencyProbe> {
  if (!process.env.QSTASH_TOKEN) {
    return { name: 'qstash', status: 'SKIPPED', durationMs: 0 };
  }
  const url = process.env.QSTASH_HEALTH_URL ?? 'https://qstash.upstash.io';
  const start = Date.now();
  try {
    const response = await withProbeTimeout(
      fetch(url, { method: 'HEAD', cache: 'no-store' }),
      PROBE_TIMEOUT_MS,
      'qstash',
    );
    // 405/404 mean we reached an Upstash edge — treat as OK.
    if (!response.ok && response.status !== 405 && response.status !== 404) {
      return {
        name: 'qstash',
        status: 'FAIL',
        durationMs: Date.now() - start,
        reason: `HEAD returned ${response.status}`,
      };
    }
    return { name: 'qstash', status: 'OK', durationMs: Date.now() - start };
  } catch (err) {
    return {
      name: 'qstash',
      status: 'FAIL',
      durationMs: Date.now() - start,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeR2(): Promise<DependencyProbe> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET_NAME_EU;
  if (!(accountId && accessKey && secretKey && bucket)) {
    return { name: 'r2', status: 'SKIPPED', durationMs: 0 };
  }
  const canaryKey = process.env.R2_HEALTHCHECK_KEY ?? '_health/canary.txt';
  const start = Date.now();
  try {
    const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
    await withProbeTimeout(
      client.send(new HeadObjectCommand({ Bucket: bucket, Key: canaryKey })),
      PROBE_TIMEOUT_MS,
      'r2',
    );
    return { name: 'r2', status: 'OK', durationMs: Date.now() - start };
  } catch (err) {
    // 404 on the canary still proves connectivity + auth.
    const isNotFound =
      typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      ((err as { name: string }).name === 'NotFound' ||
        (err as { name: string }).name === 'NoSuchKey');
    if (isNotFound) return { name: 'r2', status: 'OK', durationMs: Date.now() - start };
    return {
      name: 'r2',
      status: 'FAIL',
      durationMs: Date.now() - start,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeClamAV(): Promise<DependencyProbe> {
  const host = process.env.CLAMAV_HOST;
  const port = process.env.CLAMAV_PORT;
  if (!(host && port)) {
    return { name: 'clamav', status: 'SKIPPED', durationMs: 0 };
  }
  const start = Date.now();
  try {
    // Lazy-load `node:net` so the helper stays Edge-runtime-safe at import
    // time (callers can probe everything except clamav from the edge).
    const net = await import('node:net');
    await withProbeTimeout(
      new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({ host, port: Number(port) });
        socket.once('connect', () => {
          socket.write('zPING\0');
        });
        socket.once('data', data => {
          const reply = data.toString('utf8').trim();
          socket.end();
          if (reply.includes('PONG')) resolve();
          else reject(new Error(`unexpected clamav reply: ${reply}`));
        });
        socket.once('error', err => reject(err));
      }),
      PROBE_TIMEOUT_MS,
      'clamav',
    );
    return { name: 'clamav', status: 'OK', durationMs: Date.now() - start };
  } catch (err) {
    return {
      name: 'clamav',
      status: 'FAIL',
      durationMs: Date.now() - start,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Surface integrations-as-a-whole health from the per-provider circuit
 * breakers maintained by `resilience.ts`. We treat the integrations layer
 * as DEGRADED when at least one breaker is open or half-open and OK
 * otherwise. Provider-specific detail is included so dashboards can drill
 * down without a second call.
 */
function probeIntegrations(): DependencyProbe {
  const start = Date.now();
  const snapshots = getBreakerSnapshots();
  const open = snapshots.filter(s => s.state === 'OPEN');
  const halfOpen = snapshots.filter(s => s.state === 'HALF_OPEN');
  const status: DependencyHealthStatus = open.length > 0 || halfOpen.length > 0 ? 'DEGRADED' : 'OK';
  return {
    name: 'integrations',
    status,
    durationMs: Date.now() - start,
    reason:
      status === 'DEGRADED'
        ? `${open.length} open / ${halfOpen.length} half-open breaker(s)`
        : undefined,
    details: {
      breakers: snapshots,
    },
  };
}

/**
 * Aggregates dependency health across DB, Redis, QStash, R2, ClamAV, and
 * the integrations layer (per-provider circuit breakers). Probes run in
 * parallel with per-probe wall-clock bounds; each failure is isolated and
 * surfaced in the result alongside the overall status.
 *
 * Overall `status` mapping:
 *  - any probe FAIL  -> FAIL
 *  - any probe DEGRADED (and no FAILs) -> DEGRADED
 *  - all OK / SKIPPED -> OK
 *
 * Cache the result in Redis with a 30s TTL at the call site if you intend
 * to expose this on a polled endpoint — the probes themselves do not
 * cache so the function remains useful as a debugging tool.
 */
export async function getDependencyHealth(): Promise<DependencyHealthSnapshot> {
  const settled = await Promise.allSettled([
    probeDatabase(),
    probeRedis(),
    probeQStash(),
    probeR2(),
    probeClamAV(),
    Promise.resolve(probeIntegrations()),
  ]);

  const probes: DependencyProbe[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    const names = ['database', 'redis', 'qstash', 'r2', 'clamav', 'integrations'] as const;
    return {
      name: names[i] ?? 'database',
      status: 'FAIL',
      durationMs: 0,
      reason: s.reason instanceof Error ? s.reason.message : String(s.reason),
    };
  });

  const hasFail = probes.some(p => p.status === 'FAIL');
  const hasDegraded = probes.some(p => p.status === 'DEGRADED');
  const status: DependencyHealthStatus = hasFail ? 'FAIL' : hasDegraded ? 'DEGRADED' : 'OK';

  return {
    status,
    probes,
    timestamp: new Date().toISOString(),
  };
}
