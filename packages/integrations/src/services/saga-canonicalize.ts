import { createHash } from 'node:crypto';

// Phase 76 D-01/SC#2 — canonicalisation + SHA-256 hashing for SOC2 evidence-grade
// audit on DeprovisioningStep.requestSha256 / .responseSha256.
//
// The hashes are stored on every deprovisioning step so an auditor can prove WHAT
// payload was sent/received without retaining PII or secrets. Canonicalisation:
//   1. Recursively drop denylisted keys (auth headers, tokens, secrets, raw PII).
//   2. Sort object keys so logically-equal payloads hash identically regardless of
//      property order.
// Consumed by GoogleWorkspaceAdapter (Plan 76-09) and the QStash step-runner (Plan 76-06).

// Keys removed before hashing — case-insensitive match. Covers auth headers
// (T-76-09-03), bearer tokens, and obvious PII fields. The values never enter the digest.
const DENYLIST_KEYS = new Set(
  [
    'authorization',
    'auth',
    'token',
    'accesstoken',
    'access_token',
    'refreshtoken',
    'refresh_token',
    'bearer',
    'password',
    'secret',
    'apikey',
    'api_key',
    'cookie',
    'setcookie',
    'set-cookie',
    'email',
    'primaryemail',
    'primary_email',
    'name',
    'givenname',
    'familyname',
    'phone',
  ].map(k => k.toLowerCase()),
);

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !DENYLIST_KEYS.has(key.toLowerCase()))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, v]) => [key, canonicalize(v)] as const);
  return Object.fromEntries(entries);
}

/** Stable, PII-stripped JSON string of a request payload. */
export function canonicalizeRequest(payload: unknown): string {
  return JSON.stringify(canonicalize(payload));
}

/** Stable, PII-stripped JSON string of a response payload. */
export function canonicalizeResponse(payload: unknown): string {
  return JSON.stringify(canonicalize(payload));
}

/** SHA-256 hex digest of a canonicalised payload string. */
export function sha256Hex(canonicalString: string): string {
  return createHash('sha256').update(canonicalString).digest('hex');
}
