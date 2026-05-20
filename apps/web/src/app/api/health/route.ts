import { getQueueDepthSnapshot } from '@contractor-ops/api/services/cron-monitor';
import { prisma } from '@contractor-ops/db';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { CACHE_CONTROL_HEALTH } from '@/lib/cache-control';

// Cache-Control: `public, max-age=60, must-revalidate` — public liveness
// endpoint. A brief CDN cache absorbs monitor bursts (Render, Cronitor,
// uptime-kuma) without letting a stale `ok` body mask a real outage.
export const dynamic = 'force-dynamic';

/**
 * Real health check endpoint. Phase 2 P2-E F-OBS-07.
 *
 * Replaces the previous `SELECT 1`-only stub with an awaited
 * `Promise.allSettled` of five probes covering every external service the
 * app cannot operate without plus the QStash backpressure semaphores:
 *
 *   - Postgres (Neon)             — `prisma.$queryRaw\`SELECT 1\``
 *   - Upstash Redis               — `PING`
 *   - Upstash QStash              — HEAD on the public health URL
 *   - Cloudflare R2 (S3 API)      — HEAD on a known canary key
 *   - QStash backpressure         — depth < 1.5x maxConcurrent per route
 *                                   (S3-4 · F-SCALE-19)
 *
 * Each probe runs with a per-probe 1.5s soft timeout; the overall handler
 * caps at 5s so Render's healthcheck doesn't block scheduling decisions.
 *
 * Returns 200 when ALL configured probes succeed, 503 with a per-probe
 * diagnostic JSON otherwise. Probes whose env vars are absent are reported
 * as `skipped` (not a failure) so dev / preview environments can still go
 * green when only DB is configured.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Per-probe timeout (ms). Conservative — Render hits this every 5–15s. */
const PROBE_TIMEOUT_MS = 1_500;

/** Overall handler timeout (ms). Render's HTTP timeout is 30s on most plans. */
const HANDLER_TIMEOUT_MS = 5_000;

/** Canary key used for the R2 HEAD probe. Must exist in the bucket. */
const R2_CANARY_KEY = process.env.R2_HEALTHCHECK_KEY ?? '_health/canary.txt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProbeStatus = 'ok' | 'fail' | 'skipped';

interface ProbeResult {
  name: 'database' | 'redis' | 'qstash' | 'r2' | 'backpressure';
  status: ProbeStatus;
  /** Wall-clock duration in ms. Always present (even for skipped probes). */
  durationMs: number;
  /** Failure reason — populated on `fail` only. */
  reason?: string;
  /**
   * Optional per-route diagnostic for the backpressure probe — included
   * only when at least one route is over its threshold so a green probe
   * stays compact.
   */
  saturated?: Array<{
    routeKey: string;
    depth: number;
    threshold: number;
    max: number;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Probes
// ---------------------------------------------------------------------------

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
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
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
  // Upstash exposes https://qstash.upstash.io as the public surface; a HEAD
  // there returns 200 when the regional endpoint is healthy. We don't need
  // an auth token — this is purely a reachability check from our region.
  const url = process.env.QSTASH_HEALTH_URL ?? 'https://qstash.upstash.io';
  if (!process.env.QSTASH_TOKEN) return skipped('qstash');

  const start = performance.now();
  try {
    // resilience: raw-fetch-OK reason=QStash health probe; bounded by withTimeout (PROBE_TIMEOUT_MS) and intentionally bypasses the resilience breaker so a depended-on outage does not poison the health endpoint itself.
    const response = await withTimeout(
      fetch(url, { method: 'HEAD', cache: 'no-store' }),
      PROBE_TIMEOUT_MS,
    );
    if (!response.ok && response.status !== 405 && response.status !== 404) {
      // Some Upstash edges respond 405 (method not allowed) to HEAD; treat
      // that — and 404 — as reachable, since they prove the TLS handshake
      // and HTTP roundtrip succeeded.
      throw new Error(`qstash HEAD returned ${response.status}`);
    }
    return ok('qstash', start);
  } catch (err) {
    return fail('qstash', start, err);
  }
}

async function probeBackpressure(): Promise<ProbeResult> {
  // S3-4 · F-SCALE-19: read the per-route Redis semaphore depth and fail
  // the probe iff any route is over `Math.floor(max * 1.5)`. Skip when
  // Redis is unconfigured — the snapshot returns depth=0 for every route
  // in that case so the probe is naturally green.
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!(url && token)) return skipped('backpressure');

  const start = performance.now();
  try {
    const snapshot = await withTimeout(getQueueDepthSnapshot(), PROBE_TIMEOUT_MS);
    const saturated = snapshot.filter(entry => entry.saturated);
    if (saturated.length === 0) {
      return ok('backpressure', start);
    }
    const result: ProbeResult = {
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
    return result;
  } catch (err) {
    return fail('backpressure', start, err);
  }
}

async function probeR2(): Promise<ProbeResult> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET_NAME_EU;
  if (!(accountId && accessKey && secretKey && bucket)) return skipped('r2');

  const start = performance.now();
  try {
    // Use the AWS SDK directly so this route doesn't import packages/api/r2
    // (which has heavier deps). Dynamic import avoids penalising cold starts
    // on requests that don't need health probes.
    const { S3Client, HeadObjectCommand, S3ServiceException } = await import('@aws-sdk/client-s3');

    const endpoint = process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`;
    const client = new S3Client({
      region: 'auto',
      endpoint,
      forcePathStyle: process.env.R2_FORCE_PATH_STYLE === 'true',
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });

    await withTimeout(
      client.send(new HeadObjectCommand({ Bucket: bucket, Key: R2_CANARY_KEY })),
      PROBE_TIMEOUT_MS,
    );
    return ok('r2', start);
  } catch (err) {
    // A 404 on the canary key still proves connectivity + auth; treat that
    // as `ok` so missing-canary doesn't fail healthchecks pre-deploy.
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

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

export async function GET() {
  const start = performance.now();
  const probes = [probeDatabase(), probeRedis(), probeQStash(), probeR2(), probeBackpressure()];

  const settled = await withTimeout(Promise.allSettled(probes), HANDLER_TIMEOUT_MS).catch(err => {
    // If even allSettled timed out, return synthetic fail rows so we still
    // surface useful info to Render / monitors.
    return [
      { status: 'rejected' as const, reason: err },
      { status: 'rejected' as const, reason: err },
      { status: 'rejected' as const, reason: err },
      { status: 'rejected' as const, reason: err },
      { status: 'rejected' as const, reason: err },
    ];
  });

  const results: ProbeResult[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    const name = (['database', 'redis', 'qstash', 'r2', 'backpressure'] as const)[i] ?? 'database';
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

  const body = {
    status: allOk ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    durationMs: totalMs,
    probes: results,
  };

  return NextResponse.json(body, {
    status: allOk ? 200 : 503,
    headers: { 'Cache-Control': CACHE_CONTROL_HEALTH },
  });
}
