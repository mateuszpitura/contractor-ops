/**
 * API-key leak alarm (INTEG-SEC-05).
 *
 * A key used from more than 3 distinct source IPs in 24h is a strong leak
 * signal. This reads the Phase-99 `ApiKeyIpEvent` log (append-on-auth, already
 * normalized to the proxy-trusted left-most XFF hop — never a client-set chain),
 * groups DISTINCT `ipAddress` per `apiKeyId`, and raises an org-admin alarm for
 * each key over the threshold — reusing the job-health Sentry-alert pattern and
 * carrying only the key PREFIX (never the plaintext key). Idempotent within a
 * day bucket so it does not re-alarm the same key every run.
 */

import { prisma } from '@contractor-ops/db';
import { metrics } from '@contractor-ops/logger/metrics';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

const LEAK_IP_THRESHOLD = 3;
const WINDOW_HOURS = 24;

/** Dedup so a suspected key does not re-alarm every hourly run within a day. */
const alarmedBuckets = new Set<string>();

export const apiKeyLeakAlarmHandler: JobHandler = async ctx => {
  const start = performance.now();
  try {
    const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);
    const events = await prisma.apiKeyIpEvent.findMany({
      where: { seenAt: { gte: since } },
      select: { apiKeyId: true, ipAddress: true, organizationId: true },
    });

    const ipsByKey = new Map<string, Set<string>>();
    const orgByKey = new Map<string, string>();
    for (const event of events) {
      let ips = ipsByKey.get(event.apiKeyId);
      if (!ips) {
        ips = new Set<string>();
        ipsByKey.set(event.apiKeyId, ips);
      }
      ips.add(event.ipAddress);
      orgByKey.set(event.apiKeyId, event.organizationId);
    }

    const suspects = [...ipsByKey.entries()].filter(([, ips]) => ips.size > LEAK_IP_THRESHOLD);
    metrics.gauge('jobs.apikey.leak_suspects', suspects.length);

    if (suspects.length === 0) {
      return { ok: true, durationMs: Math.round(performance.now() - start), details: { suspects: 0 } };
    }

    const keys = await prisma.organizationApiKey.findMany({
      where: { id: { in: suspects.map(([id]) => id) } },
      select: { id: true, prefix: true, organizationId: true },
    });
    const prefixById = new Map(keys.map(key => [key.id, key.prefix]));

    const bucket = new Date().toISOString().slice(0, 10);
    let alarmed = 0;
    for (const [apiKeyId, ips] of suspects) {
      const dedupKey = `${apiKeyId}:${bucket}`;
      if (alarmedBuckets.has(dedupKey)) continue;
      alarmedBuckets.add(dedupKey);

      const prefix = prefixById.get(apiKeyId) ?? '(unknown)';
      const organizationId = orgByKey.get(apiKeyId);
      const msg = `API key leak suspected: key ${prefix} used from ${ips.size} distinct source IPs in ${WINDOW_HOURS}h (threshold ${LEAK_IP_THRESHOLD})`;
      ctx.log.error({ apiKeyPrefix: prefix, distinctIps: ips.size, organizationId }, msg);
      Sentry.captureMessage(msg, {
        level: 'warning',
        tags: { 'cron.job': 'api-key-leak-alarm', 'alert.type': 'key_leak' },
        extra: { apiKeyPrefix: prefix, distinctIps: ips.size, organizationId },
      });
      alarmed += 1;
    }

    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { suspects: suspects.length, alarmed },
    };
  } catch (err) {
    ctx.log.error({ err }, 'api-key leak alarm failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'api-key-leak-alarm' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};
