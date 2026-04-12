import { HttpResponse, http } from "msw";
import type { HandlerOptions } from "../types.js";
import { applyNetworkConditions } from "../utils.js";

/**
 * In-memory key-value store for simulating Upstash Redis REST API.
 * Shared across handlers so GET returns what SET stored.
 */
const store = new Map<string, { value: unknown; expiresAt?: number }>();

/**
 * Upstash Redis REST API mock handlers.
 *
 * The Upstash SDK sends commands as POST requests to the REST URL:
 * POST {UPSTASH_REDIS_REST_URL}
 * Body: ["SET", "key", "value", "EX", 300] or ["GET", "key"] etc.
 *
 * Matches any *.upstash.io URL so it works regardless of the actual
 * UPSTASH_REDIS_REST_URL env var value.
 */
export function upstashRedisHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- Single Command (matches any Upstash URL) ---
    http.post("https://*.upstash.io", async ({ request }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;

      const body = (await request.json()) as string[];
      const command = body[0]?.toUpperCase();

      switch (command) {
        case "GET": {
          const key = body[1]!;
          const entry = store.get(key);
          if (!entry || (entry.expiresAt && entry.expiresAt < Date.now())) {
            store.delete(key);
            return HttpResponse.json({ result: null });
          }
          return HttpResponse.json({ result: entry.value });
        }
        case "SET": {
          const key = body[1]!;
          const value = body[2];
          let expiresAt: number | undefined;
          const exIdx = body.findIndex((b) => b.toUpperCase() === "EX");
          if (exIdx !== -1 && body[exIdx + 1]) {
            expiresAt = Date.now() + parseInt(body[exIdx + 1]!, 10) * 1000;
          }
          store.set(key, { value, expiresAt });
          return HttpResponse.json({ result: "OK" });
        }
        case "DEL": {
          const keys = body.slice(1);
          let deleted = 0;
          for (const k of keys) {
            if (store.delete(k)) deleted++;
          }
          return HttpResponse.json({ result: deleted });
        }
        case "SCAN": {
          const pattern = body[3]; // ["SCAN", cursor, "MATCH", pattern, "COUNT", count]
          const allKeys = [...store.keys()];
          const matched = pattern
            ? allKeys.filter((k) => {
                const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
                return regex.test(k);
              })
            : allKeys;
          return HttpResponse.json({ result: ["0", matched] });
        }
        default:
          return HttpResponse.json({ result: "OK" });
      }
    }),

    // --- Pipeline (batch commands) ---
    http.post("https://*.upstash.io/pipeline", async ({ request }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;

      const commands = (await request.json()) as string[][];
      const results = commands.map(() => ({ result: "OK" }));
      return HttpResponse.json(results);
    }),
  ];
}

/** Clear the in-memory Redis store between tests */
export function clearRedisStore(): void {
  store.clear();
}
