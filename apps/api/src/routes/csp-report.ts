/**
 * CSP violation report sink.
 *
 * Accepts both the legacy `Content-Type: application/csp-report` body
 * (`{ "csp-report": {…} }`) and the modern Reporting API v1 array
 * (`Content-Type: application/reports+json` → `[{ type, body, … }]`).
 * Logs each report at `warn` so they stream to Axiom via the existing
 * Pino pipeline and adds a Sentry breadcrumb so a subsequent captured
 * exception in the same isolation scope carries the CSP context.
 *
 * Always returns 204 — a non-success status would trigger browser
 * retries on a hot path during a misconfigured CSP rollout.
 *
 * Exempt from CSRF origin guard (csrf-origin.ts) because the browser
 * emits the POST with no Origin / Referer header.
 */

import { createLogger } from '@contractor-ops/logger';
import type { FastifyInstance } from 'fastify';
import { Sentry } from '../lib/sentry.js';

const log = createLogger({ service: 'csp-report' });

interface LegacyCspReport {
  'csp-report'?: Record<string, unknown>;
}

interface ReportApiEntry {
  type?: string;
  age?: number;
  url?: string;
  user_agent?: string;
  body?: Record<string, unknown>;
}

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

export function registerCspReportRoute(app: FastifyInstance): void {
  app.post('/csp-report', async (request, reply) => {
    const body = request.body as unknown;

    if (isReportApiPayload(body)) {
      for (const entry of body) {
        log.warn(
          {
            cspReport: {
              shape: 'reports-api-v1',
              type: entry.type,
              url: entry.url,
              userAgent: entry.user_agent,
              age: entry.age,
              body: entry.body,
            },
          },
          'csp violation report',
        );
        Sentry.addBreadcrumb({
          category: 'csp',
          level: 'warning',
          message: 'csp violation report (reports-api-v1)',
          data: { type: entry.type, url: entry.url, ...entry.body },
        });
      }
    } else if (isLegacyPayload(body)) {
      log.warn(
        { cspReport: { shape: 'legacy', body: body['csp-report'] } },
        'csp violation report',
      );
      Sentry.addBreadcrumb({
        category: 'csp',
        level: 'warning',
        message: 'csp violation report (legacy)',
        data: body['csp-report'],
      });
    } else {
      log.warn({ body }, 'csp-report: unrecognised payload shape');
    }

    return reply.code(204).send();
  });
}
