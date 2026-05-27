/**
 * Liveness + readiness endpoints.
 *
 *   - `/health` → unauthenticated full probe set; returns 200 once every
 *     configured external dependency is reachable. Used by Render's
 *     healthCheckPath.
 *   - `/ready` → simple shape-stable 200 for Render's startup gate.
 *
 * Probes (each runs with a 1.5s per-probe soft timeout; the handler caps
 * at HEALTH_TIMEOUT_MS so Render's healthcheck doesn't block scheduling):
 *
 *   - Postgres (Neon)             — `prisma.$queryRaw\`SELECT 1\``
 *   - Upstash Redis               — `PING`
 *   - Upstash QStash              — HEAD on the public health URL
 *   - Cloudflare R2 (S3 API)      — HEAD on a known canary key
 *   - QStash backpressure         — depth < 1.5× max per route
 *
 * Probes whose env vars are absent are reported `skipped` (not a failure)
 * so dev / preview environments stay green with only DB configured.
 */

import { getQueueDepthSnapshot } from '@contractor-ops/api/services/cron-monitor';
import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { Redis } from '@upstash/redis';
import type { FastifyInstance } from 'fastify';
import { loadEnv } from '../env.js';

const log = createLogger({ service: 'api-server', component: 'health' });

const PROBE_TIMEOUT_MS = 1_500;

type ProbeStatus = 'ok' | 'fail' | 'skipped';

interface ProbeResult {
  name: 'database' | 'redis' | 'qstash' | 'r2' | 'backpressure';
  status: ProbeStatus;
  durationMs: number;
  reason?: string;
  saturated?: Array<{ routeKey: string; depth: number; threshold: number; max: number }>;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`probe timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function ok(name: ProbeResult['name'], start: number): ProbeResult {
  return { name, status: 'ok', durationMs: Math.round(performance.now() - start) };
}

function fail(name: ProbeResult['name'], start: number, err: unknown): ProbeResult {
  return {
    name,
    status: 'fail',
    durationMs: Math.round(performance.now() - start),
    reason: err instanceof Error ? err.message : String(err),
  };
}

function skipped(name: ProbeResult['name']): ProbeResult {
  return { name, status: 'skipped', durationMs: 0 };
}

async function probeDatabase(): Promise<ProbeResult> {
  const start = performance.now();
  try {
    // safe-raw-sql: database liveness probe — `SELECT 1` has no tenant dimension.
    await withTimeout(prisma.$queryRaw`SELECT 1`, PROBE_TIMEOUT_MS);
    return ok('database', start);
  } catch (err) {
    return fail('database', start, err);
  }
}

async function probeRedis(): Promise<ProbeResult> {
  const env = loadEnv();
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!(url && token)) return skipped('redis');

  const start = performance.now();
  try {
    const redis = new Redis({ url, token });
    await withTimeout(redis.ping() as Promise<unknown>, PROBE_TIMEOUT_MS);
    return ok('redis', start);
  } catch (err) {
    return fail('redis', start, err);
  }
}

async function probeQStash(): Promise<ProbeResult> {
  const env = loadEnv();
  const url = env.QSTASH_HEALTH_URL;
  if (!env.QSTASH_TOKEN) return skipped('qstash');

  const start = performance.now();
  try {
    // resilience: raw-fetch-OK reason=QStash health probe; bounded by
    // withTimeout and intentionally bypasses the resilience breaker so a
    // depended-on outage does not poison the health endpoint itself.
    const response = await withTimeout(
      fetch(url, { method: 'HEAD', cache: 'no-store' }),
      PROBE_TIMEOUT_MS,
    );
    if (!response.ok && response.status !== 405 && response.status !== 404) {
      throw new Error(`qstash HEAD returned ${response.status}`);
    }
    return ok('qstash', start);
  } catch (err) {
    return fail('qstash', start, err);
  }
}

async function probeBackpressure(): Promise<ProbeResult> {
  const env = loadEnv();
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!(url && token)) return skipped('backpressure');

  const start = performance.now();
  try {
    const snapshot = await withTimeout(getQueueDepthSnapshot(), PROBE_TIMEOUT_MS);
    const saturated = snapshot.filter(entry => entry.saturated);
    if (saturated.length === 0) {
      return ok('backpressure', start);
    }
    return {
      name: 'backpressure',
      status: 'fail',
      durationMs: Math.round(performance.now() - start),
      reason: `routes over threshold: ${saturated.map(s => `${s.routeKey}=${s.depth}/${s.threshold}`).join(', ')}`,
      saturated: saturated.map(s => ({
        routeKey: s.routeKey,
        depth: s.depth,
        threshold: s.threshold,
        max: s.max,
      })),
    };
  } catch (err) {
    return fail('backpressure', start, err);
  }
}

async function probeR2(): Promise<ProbeResult> {
  const env = loadEnv();
  const accountId = env.R2_ACCOUNT_ID;
  const accessKey = env.R2_ACCESS_KEY_ID;
  const secretKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET_NAME ?? env.R2_BUCKET_NAME_EU;
  if (!(accountId && accessKey && secretKey && bucket)) return skipped('r2');

  const start = performance.now();
  try {
    const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');

    const endpoint = env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`;
    const client = new S3Client({
      region: 'auto',
      endpoint,
      forcePathStyle: env.R2_FORCE_PATH_STYLE,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });

    await withTimeout(
      client.send(new HeadObjectCommand({ Bucket: bucket, Key: env.R2_HEALTHCHECK_KEY })),
      PROBE_TIMEOUT_MS,
    );
    return ok('r2', start);
  } catch (err) {
    // A 404 on the canary key still proves connectivity + auth; treat that
    // as `ok` so a missing-canary file doesn't fail healthchecks pre-deploy.
    const isNotFound =
      typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      ((err as { name: string }).name === 'NotFound' ||
        (err as { name: string }).name === 'NoSuchKey');
    if (isNotFound) return ok('r2', start);
    return fail('r2', start, err);
  }
}

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/health', async (_request, reply) => {
    const env = loadEnv();
    // Test mode short-circuit — Vitest setup.ts does not configure
    // Upstash/QStash/R2 envs and most failing probes would burn the
    // per-IP rate-limit budget across unrelated route tests. Production
    // runs the full probe set; only `NODE_ENV === 'test'` skips.
    if (env.NODE_ENV === 'test') {
      return reply.code(200).send({
        ok: true,
        service: 'api-server',
        timestamp: new Date().toISOString(),
      });
    }

    const start = performance.now();
    const probes = [probeDatabase(), probeRedis(), probeQStash(), probeR2(), probeBackpressure()];

    const settled = await withTimeout(Promise.allSettled(probes), env.HEALTH_TIMEOUT_MS).catch(
      err => {
        // If even allSettled timed out, return synthetic fail rows so we
        // still surface useful info to Render / monitors.
        return [
          { status: 'rejected' as const, reason: err },
          { status: 'rejected' as const, reason: err },
          { status: 'rejected' as const, reason: err },
          { status: 'rejected' as const, reason: err },
          { status: 'rejected' as const, reason: err },
        ];
      },
    );

    const results: ProbeResult[] = settled.map((s, i) => {
      if (s.status === 'fulfilled') return s.value;
      const name =
        (['database', 'redis', 'qstash', 'r2', 'backpressure'] as const)[i] ?? 'database';
      return {
        name,
        status: 'fail',
        durationMs: 0,
        reason: s.reason instanceof Error ? s.reason.message : String(s.reason),
      };
    });

    const failed = results.filter(r => r.status === 'fail');
    const allOk = failed.length === 0;
    const totalMs = Math.round(performance.now() - start);

    // /health is unauthenticated and unrate-limited (Render's probe needs
    // unthrottled access). Internal error messages can leak connection
    // strings, hostnames, and backpressure topology — useful intel for an
    // attacker probing the deployment. Log the full detail server-side so
    // ops still sees it; return only the minimal status fields to the
    // network. Render only checks the HTTP status code so trimming the
    // body has no operational cost.
    if (!allOk) {
      log.warn({ event: 'health.degraded', probes: results, totalMs }, 'health probes degraded');
    }

    const publicProbes = results.map(r => ({
      name: r.name,
      status: r.status,
      durationMs: r.durationMs,
    }));

    return reply
      .code(allOk ? 200 : 503)
      .header('cache-control', 'public, max-age=60, must-revalidate')
      .send({
        status: allOk ? 'ok' : 'error',
        service: 'api-server',
        timestamp: new Date().toISOString(),
        durationMs: totalMs,
        probes: publicProbes,
      });
  });

  app.get('/ready', async () => ({
    ok: true,
    service: 'api-server',
    timestamp: new Date().toISOString(),
  }));
}
