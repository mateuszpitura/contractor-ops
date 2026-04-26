import type { HttpHandler } from 'msw';
import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions } from '../utils.js';

/**
 * In-memory key-value store for simulating Upstash Redis REST API.
 * Shared across handlers so GET returns what SET stored.
 */
const store = new Map<string, { value: unknown; expiresAt?: number }>();

/**
 * Redis REST on *.upstash.io (excludes QStash hostname). For MSW path matching.
 */
export function isUpstashRedisApiHostname(hostname: string): boolean {
  return hostname.endsWith('.upstash.io') && hostname !== 'qstash.upstash.io';
}

export function isUpstashRedisSingleCommandUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!isUpstashRedisApiHostname(u.hostname)) return false;
    return !u.pathname.includes('/pipeline');
  } catch {
    return false;
  }
}

export function isUpstashRedisPipelineUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!isUpstashRedisApiHostname(u.hostname)) return false;
    return u.pathname.includes('/pipeline');
  } catch {
    return false;
  }
}

/**
 * Upstash Redis REST API mock handlers.
 *
 * The Upstash SDK sends commands as POST requests to the REST URL.
 * Uses URL predicates (avoid `https://*.upstash.io` — path-to-regexp v8).
 */
function handleGet(body: string[]): unknown {
  const key = body[1] ?? '';
  const entry = store.get(key);
  if (!entry || (entry.expiresAt && entry.expiresAt < Date.now())) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function handleSet(body: string[]): unknown {
  const key = body[1] ?? '';
  const value = body[2];
  let expiresAt: number | undefined;
  const exIdx = body.findIndex(b => b.toUpperCase() === 'EX');
  if (exIdx !== -1 && body[exIdx + 1]) {
    expiresAt = Date.now() + parseInt(body[exIdx + 1] ?? '0', 10) * 1000;
  }
  store.set(key, { value, expiresAt });
  return 'OK';
}

function handleDel(body: string[]): unknown {
  const keys = body.slice(1);
  let deleted = 0;
  for (const k of keys) {
    if (store.delete(k)) deleted++;
  }
  return deleted;
}

function handleScan(body: string[]): unknown {
  const pattern = body[3];
  const allKeys = [...store.keys()];
  const matched = pattern
    ? allKeys.filter(k => {
        const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
        return regex.test(k);
      })
    : allKeys;
  return ['0', matched];
}

const redisCommandHandlers: Record<string, (body: string[]) => unknown> = {
  GET: handleGet,
  SET: handleSet,
  DEL: handleDel,
  SCAN: handleScan,
};

/** One REST command body: Redis command + args (Upstash JSON encoding). */
function runRedisCommand(body: string[]): { result: unknown } {
  const command = body[0]?.toUpperCase() ?? '';
  const handler = redisCommandHandlers[command];
  return { result: handler ? handler(body) : 'OK' };
}

export function upstashRedisHandlers(options?: HandlerOptions): HttpHandler[] {
  const net = options?.network;

  return [
    http.post(
      ({ request }) => isUpstashRedisSingleCommandUrl(request.url),
      async ({ request }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        const body = (await request.json()) as string[];
        const { result } = runRedisCommand(body);
        return HttpResponse.json({ result });
      },
    ),

    /**
     * @upstash/redis auto-pipelines many commands (incl. get/set) to POST …/pipeline
     * with body: [["GET", ...], ["SET", ...]]. The mock must mutate `store` per command.
     */
    http.post(
      ({ request }) => isUpstashRedisPipelineUrl(request.url),
      async ({ request }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;

        const commands = (await request.json()) as string[][];
        const results = commands.map(cmd => {
          const { result } = runRedisCommand(cmd);
          return { result, error: null };
        });
        return HttpResponse.json(results);
      },
    ),
  ];
}

/** Clear the in-memory Redis store between tests */
export function clearRedisStore(): void {
  store.clear();
}
