/**
 * Pino Writable stream that batches log lines and pushes them to a local
 * Loki instance via the `/loki/api/v1/push` endpoint.
 *
 * Mirrors the design of `axiom-stream.ts`:
 *
 *   - synchronous Writable (no worker threads, plays with esbuild / Vite)
 *   - per-line JSON.parse to extract Pino metadata; on parse failure the
 *     raw text is shipped as the log line
 *   - small in-memory buffer flushed on a fixed interval, plus on process
 *     exit / SIGTERM to avoid losing the tail
 *
 * The stream is intended for **local dev only**. Pointing it at a
 * production Loki cluster would work but the absence of multi-tenant
 * headers / auth means it is unsuitable for shared environments. Prod
 * keeps shipping through Axiom — see `index.ts` `createRootLogger()`.
 */

import { Writable } from 'node:stream';

type LokiStreamOptions = {
  url: string;
  service?: string;
  // Optional `X-Scope-OrgID` for multi-tenant Loki; rare in dev, present
  // for the rare developer running their team's shared cluster.
  tenantId?: string;
  // Flush cadence — keep it short so the dev tail stays interactive.
  flushIntervalMs?: number;
  // Max bytes accumulated before forcing a flush regardless of cadence.
  maxBatchBytes?: number;
  // Inject a custom fetch — keeps the module testable without globalThis.
  fetchImpl?: typeof fetch;
};

type LokiEntry = [string, string]; // [nanoTimestamp, line]

type LokiPushBody = {
  streams: Array<{
    stream: Record<string, string>;
    values: LokiEntry[];
  }>;
};

function nowNanos(): string {
  // Loki wants nanosecond-precision string timestamps. Date is millisecond,
  // so left-pad with `'000000'` to fake the nanosecond suffix — good enough
  // for chronological ordering inside a Grafana panel.
  return `${Date.now()}000000`;
}

export function createLokiStream(opts: LokiStreamOptions): Writable {
  const url = opts.url.replace(/\/$/, '');
  const endpoint = `${url}/loki/api/v1/push`;
  const flushIntervalMs = opts.flushIntervalMs ?? 2000;
  const maxBatchBytes = opts.maxBatchBytes ?? 1024 * 256;
  const fetchImpl: typeof fetch = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const defaultLabels: Record<string, string> = {
    service: opts.service ?? 'app',
    source: 'pino',
  };

  // Group entries by serialized label string so distinct service / level
  // combinations land as separate Loki streams. Map insertion order is
  // preserved which keeps flush deterministic.
  const buckets = new Map<string, { stream: Record<string, string>; values: LokiEntry[] }>();
  let bufferedBytes = 0;

  const enqueue = (labels: Record<string, string>, line: string) => {
    const key = JSON.stringify(labels);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { stream: labels, values: [] };
      buckets.set(key, bucket);
    }
    bucket.values.push([nowNanos(), line]);
    bufferedBytes += line.length;
    if (bufferedBytes >= maxBatchBytes) {
      void flush();
    }
  };

  const flush = async (): Promise<void> => {
    if (buckets.size === 0) return;
    const body: LokiPushBody = { streams: [] };
    for (const bucket of buckets.values()) {
      if (bucket.values.length === 0) continue;
      body.streams.push({ stream: bucket.stream, values: bucket.values.slice() });
      bucket.values.length = 0;
    }
    bufferedBytes = 0;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (opts.tenantId) headers['x-scope-orgid'] = opts.tenantId;
    try {
      await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch {
      // Swallow — dev log shipping is best-effort. The line already hit
      // stdout via the parallel pino-pretty stream so nothing is lost.
    }
  };

  const interval = setInterval(() => {
    void flush();
  }, flushIntervalMs);
  // Allow the host process to exit even if the timer is alive (the cleanup
  // below pumps a final flush from beforeExit / SIGTERM regardless).
  if (typeof interval.unref === 'function') interval.unref();

  const cleanup = () => {
    clearInterval(interval);
    void flush();
  };
  process.once('beforeExit', cleanup);
  process.once('SIGTERM', cleanup);

  return new Writable({
    write(chunk, _encoding, callback) {
      const text = chunk.toString().trim();
      if (!text) return callback();
      let line = text;
      const labels: Record<string, string> = { ...defaultLabels };
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (typeof parsed.level === 'string') labels.level = parsed.level;
        if (typeof parsed.service === 'string') labels.service = parsed.service;
        // Loki line is the JSON payload itself so structured fields stay
        // queryable via `| json` in LogQL.
        line = JSON.stringify(parsed);
      } catch {
        // Pino is configured for JSON output so a parse failure is
        // unexpected; fall through with the raw text as the log line.
      }
      enqueue(labels, line);
      callback();
    },
    final(callback) {
      void flush().then(() => callback());
    },
  });
}
