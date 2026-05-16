import { createLogger } from '@contractor-ops/logger';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Content-Security-Policy violation reporting endpoint.
 *
 * Phase C.1.b (production-hardening) — receives violation reports from the
 * `Content-Security-Policy-Report-Only` header rolled out alongside the
 * existing enforce policy. The 48h observation window before C.1.c flips the
 * enforce policy uses this endpoint to build a clean baseline.
 *
 * Accepts both report shapes:
 * - Legacy: `Content-Type: application/csp-report` -> `{ "csp-report": {...} }`
 * - Modern (Reporting API v1): `Content-Type: application/reports+json` ->
 *   `[{ "type": "csp-violation", "body": {...} }, ...]`
 *
 * Behaviour:
 * - Structured Pino log at `warn` level with the full report payload, so
 *   reports stream to Axiom via the existing logger pipeline.
 * - Sentry breadcrumb so a subsequent error in the same isolation scope
 *   carries the CSP context.
 * - Always returns 204 No Content; failures are logged but never propagated
 *   to the violating browser (which would otherwise retry on a hot path).
 *
 * Caching: `force-dynamic` so the runtime always executes (no stale 204s
 * served from a cache layer).
 */
export const dynamic = 'force-dynamic';

const log = createLogger({ service: 'csp-report' });

type LegacyCspReport = {
  'csp-report'?: Record<string, unknown>;
};

type ReportApiEntry = {
  type?: string;
  age?: number;
  url?: string;
  user_agent?: string;
  body?: Record<string, unknown>;
};

function isReportApiPayload(value: unknown): value is ReportApiEntry[] {
  return Array.isArray(value);
}

function isLegacyPayload(value: unknown): value is LegacyCspReport {
  return (
    typeof value === 'object' &&
    value !== null &&
    'csp-report' in (value as Record<string, unknown>)
  );
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch (err) {
    // Browsers occasionally send malformed payloads; log and 204 so we do not
    // amplify the violation by triggering retries.
    log.warn({ err }, 'csp-report: malformed JSON payload');
    return new NextResponse(null, { status: 204 });
  }

  const reports: Array<Record<string, unknown>> = [];

  if (isReportApiPayload(payload)) {
    for (const entry of payload) {
      if (entry?.type === 'csp-violation' && entry.body) {
        reports.push(entry.body);
      }
    }
  } else if (isLegacyPayload(payload)) {
    const report = payload['csp-report'];
    if (report) {
      reports.push(report);
    }
  }

  if (reports.length === 0) {
    log.warn({ payload }, 'csp-report: no recognised violation entries');
    return new NextResponse(null, { status: 204 });
  }

  const userAgent = req.headers.get('user-agent') ?? undefined;

  for (const report of reports) {
    log.warn({ csp: report, userAgent }, 'csp-report: policy violation');

    Sentry.addBreadcrumb({
      category: 'csp',
      level: 'warning',
      message: 'CSP violation reported',
      data: { ...report, userAgent },
    });
  }

  return new NextResponse(null, { status: 204 });
}
