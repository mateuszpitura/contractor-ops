/**
 * Sentry `beforeSend` PII scrubber for @contractor-ops/cron-worker.
 *
 * Mirror of `apps/api/src/lib/sentry-scrub.ts` and
 * `apps/web-vite/src/lib/sentry-scrub.ts` — keep the PII_KEYWORDS list
 * and scrubbing strategy in lock-step across runtimes so a sensitive
 * value redacted in one is also redacted in the others.
 *
 * Without this scrubber wired into `Sentry.init({ beforeSend })`, cron
 * handlers that capture webhook payloads (Stripe / QStash / Storecove /
 * InPost / KSeF / Peppol), OAuth-token refresh failures, or per-tenant
 * IBAN / tax-id work would ship the raw bodies, headers, cookies, and
 * query strings to Sentry verbatim.
 */

import type { ErrorEvent, EventHint } from '@sentry/node';

const PII_KEYWORDS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'bankaccount',
  'bank_account',
  'iban',
  'swiftbic',
  'swift_bic',
  'taxid',
  'tax_id',
  'utr',
  'ninumber',
  'national_insurance',
  'vatnumber',
  'vatregistrationnumber',
  'companieshousenumber',
  'steuernummer',
  'ustidnr',
  'sozialversicherungsnummer',
  'svnumber',
  'svnr',
] as const;

const REDACTED = '[REDACTED]';

function isPiiKey(key: string): boolean {
  const lower = key.toLowerCase();
  for (const kw of PII_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

const MAX_DEPTH = 6;
function scrubObject(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = scrubObject(value[i], depth + 1);
    }
    return value;
  }
  if (typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (isPiiKey(key)) {
      obj[key] = REDACTED;
      continue;
    }
    obj[key] = scrubObject(obj[key], depth + 1);
  }
  return obj;
}

export function maskEmail(email: unknown): string | undefined {
  if (typeof email !== 'string' || email.length === 0) return;
  const at = email.indexOf('@');
  if (at <= 0) return REDACTED;
  return `${email.charAt(0)}***${email.slice(at)}`;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: flat sequential scrub over many independent, optional Sentry event fields — each guarded null-check is cohesive; splitting would scatter the redaction contract.
export function scrubSentryEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  if (event.user) {
    if (event.user.email) {
      event.user.email = maskEmail(event.user.email);
    }
    if (
      'ip_address' in event.user &&
      event.user.ip_address &&
      event.user.ip_address !== '{{auto}}'
    ) {
      event.user.ip_address = '{{auto}}';
    }
  }

  if (event.request?.data) {
    event.request.data = scrubObject(event.request.data) as typeof event.request.data;
  }
  if (event.request?.query_string && typeof event.request.query_string === 'string') {
    event.request.query_string = event.request.query_string.replace(
      /([?&]?)([^=&?#]+)=([^&]*)/g,
      (_, sep, key, val) => `${sep}${key}=${isPiiKey(key) ? REDACTED : val}`,
    );
  }
  if (event.request?.headers) {
    event.request.headers = scrubObject(event.request.headers) as typeof event.request.headers;
  }
  if (event.request?.cookies) {
    event.request.cookies = scrubObject(event.request.cookies) as typeof event.request.cookies;
  }

  if (event.extra) {
    event.extra = scrubObject(event.extra) as typeof event.extra;
  }
  if (event.contexts) {
    event.contexts = scrubObject(event.contexts) as typeof event.contexts;
  }
  if (event.tags) {
    event.tags = scrubObject(event.tags) as typeof event.tags;
  }
  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (crumb?.data) crumb.data = scrubObject(crumb.data) as typeof crumb.data;
    }
  }

  return event;
}
