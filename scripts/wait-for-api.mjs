#!/usr/bin/env node
// Poll the dev API server's /health endpoint until it responds 2xx, then exit.
//
// Used by `apps/web-vite` (and any other dev consumer) to delay its own boot
// until the API is ready. Without this, Vite serves the SPA before Fastify
// has bound its port; the first auth/session fetch fails with
// `TypeError: Failed to fetch` and React Router surfaces a route error.
//
// Tunables (env): WAIT_FOR_API_URL, WAIT_FOR_API_TIMEOUT_MS, WAIT_FOR_API_INTERVAL_MS.

const url =
  process.env.WAIT_FOR_API_URL ??
  process.env.VITE_API_URL?.replace(/\/$/, '').concat('/health') ??
  'http://localhost:4000/health';
const timeoutMs = Number(process.env.WAIT_FOR_API_TIMEOUT_MS ?? 60_000);
const intervalMs = Number(process.env.WAIT_FOR_API_INTERVAL_MS ?? 500);
const startedAt = Date.now();

function elapsed() {
  return Date.now() - startedAt;
}

async function probe() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(intervalMs * 4, 5_000));
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

process.stdout.write(`[wait-for-api] polling ${url} (timeout ${timeoutMs}ms)…\n`);

while (true) {
  if (await probe()) {
    process.stdout.write(`[wait-for-api] ready in ${elapsed()}ms\n`);
    process.exit(0);
  }
  if (elapsed() >= timeoutMs) {
    process.stderr.write(
      `[wait-for-api] gave up after ${timeoutMs}ms — API never answered at ${url}\n`,
    );
    process.exit(1);
  }
  await new Promise(resolve => setTimeout(resolve, intervalMs));
}
