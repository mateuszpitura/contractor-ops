/**
 * Sentry `beforeSend` PII scrubber. Phase 2 P2-E F-OBS-08.
 *
 * Pino's `redact: { paths }` only affects log destinations — Sentry events
 * (errors, breadcrumbs, request payloads, user objects) flow through an
 * independent transport. This scrubber walks the Sentry event before it
 * leaves the process and removes / masks any field whose name matches our
 * PII keyword list (bank, tax, IBAN, password, token, etc.) plus a few
 * Sentry-specific shapes (`event.user.email`, `event.request.data`).
 *
 * Keep this lightweight: Sentry calls `beforeSend` synchronously on the hot
 * path, including during error handlers, so we cannot afford regex parsing
 * of free-text. We only redact known structured fields.
 */

import type { ErrorEvent, EventHint } from '@sentry/nextjs';

// Field-name keywords (case-insensitive). When a key contains any of these
// substrings its value is replaced with `[REDACTED]`. Mirrors the Pino
// PII_MASK_KEYWORDS in @contractor-ops/logger but kept inline because the
// Sentry config file may load before workspace packages are bundled.
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

/**
 * Recursively walks an arbitrary object replacing PII-keyed values. Returns
 * the same reference so Sentry's `event` mutations stay in place. Bounded by
 * `MAX_DEPTH` to defend against pathological cyclic graphs.
 */
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

/**
 * Masks a user email to `<first-char>***@domain.tld`. Empty string -> empty
 * string. Invalid input -> redacted sentinel.
 */
export function maskEmail(email: unknown): string | undefined {
  if (typeof email !== 'string' || email.length === 0) return;
  const at = email.indexOf('@');
  if (at <= 0) return REDACTED;
  return `${email.charAt(0)}***${email.slice(at)}`;
}

/**
 * Sentry `beforeSend` hook. Mutates and returns the event (Sentry contract).
 * Returning `null` would drop the event entirely — we only ever scrub.
 */
export function scrubSentryEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  // user.email is the most common privacy hot spot — Sentry's `users
  // affected` chart relies on user.id, not the email, so masking is safe.
  if (event.user) {
    if (event.user.email) {
      event.user.email = maskEmail(event.user.email);
    }
    if (
      'ip_address' in event.user &&
      event.user.ip_address &&
      event.user.ip_address !== '{{auto}}'
    ) {
      // Drop captured IP — Sentry will still receive {{auto}} when wired in
      // server config, but free-form IPs from breadcrumbs leak location.
      event.user.ip_address = '{{auto}}';
    }
  }

  // request.data may contain raw form bodies, JSON payloads, query strings.
  if (event.request?.data) {
    event.request.data = scrubObject(event.request.data) as typeof event.request.data;
  }
  if (event.request?.query_string && typeof event.request.query_string === 'string') {
    // Cheap key-name scan: `iban=DE12...&token=...` becomes `iban=[REDACTED]&token=[REDACTED]`.
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
