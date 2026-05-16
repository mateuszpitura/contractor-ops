import { createLogger } from '@contractor-ops/logger';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Core Web Vitals ingestion endpoint.
 *
 * Phase C.6.b (production-hardening) — receives metric beacons from the
 * `<WebVitalsReporter>` client component and emits a structured Pino log per
 * metric. Logs stream to Axiom via the existing observability pipeline; no
 * separate vendor SDK is required.
 *
 * Behaviour:
 * - Accepts a single metric JSON object per request (the client batches
 *   nothing — each call to `useReportWebVitals` produces one beacon).
 * - Always returns 204 No Content so beacons impose no parsing cost on the
 *   browser side, and so failed parses cannot trigger retries.
 * - `runtime = 'nodejs'` (not edge) because the project's Pino logger uses
 *   Node-only APIs (worker threads, fs transport targets).
 *
 * Caching: `force-dynamic` so the runtime always executes (no stale 204s
 * served from a cache layer).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = createLogger({ service: 'web-vitals' });

type WebVitalPayload = {
  name?: string;
  value?: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  id?: string;
  navigationType?: string;
  url?: string;
};

export async function POST(req: NextRequest) {
  let payload: WebVitalPayload | undefined;
  try {
    payload = (await req.json()) as WebVitalPayload;
  } catch (err) {
    log.warn({ err }, 'web-vitals: malformed JSON payload');
    return new NextResponse(null, { status: 204 });
  }

  if (!payload || typeof payload !== 'object') {
    log.warn({ payload }, 'web-vitals: empty or non-object payload');
    return new NextResponse(null, { status: 204 });
  }

  log.info(
    {
      webVital: {
        name: payload.name,
        value: payload.value,
        rating: payload.rating,
        delta: payload.delta,
        id: payload.id,
        navigationType: payload.navigationType,
        url: payload.url,
      },
      userAgent: req.headers.get('user-agent') ?? undefined,
    },
    'web-vital',
  );

  return new NextResponse(null, { status: 204 });
}
