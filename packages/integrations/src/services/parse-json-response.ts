// ---------------------------------------------------------------------------
// Shared response-body validation helper
// ---------------------------------------------------------------------------
//
// Audit finding #10: adapters across this package read an external HTTP body
// via `(await response.json()) as <shape>` with NO schema validation, while
// the courier/gov-API clients (@contractor-ops/gov-api ViesClient /
// HmrcVatClient) DO validate with Zod at the response boundary. A bad or
// drifted external payload is silently coerced into the cast type; on OAuth
// token-exchange / refresh paths that corrupt value is then persisted as a
// credential (`encryptCredentials` -> `IntegrationConnection.credentialsRef`).
//
// This helper centralizes the safe pattern the gov-API clients use
// (text -> guarded JSON.parse -> Zod), so every adapter call site can replace
// its bare `as` cast with one validated call:
//
//   const data = await parseJsonResponse(response, slackOAuthTokenSchema, 'slack:exchangeCodeForTokens');
//
// Two parse modes:
//   - `parseJsonResponse` (default) -> `schema.parse` semantics (FAIL CLOSED):
//     a malformed body throws `ResponseValidationError`. Use at credential
//     -persist boundaries (OAuth exchange / refresh) so junk never reaches the
//     credential store.
//   - `safeParseJsonResponse` -> returns a discriminated result without
//     throwing, for transient data-fetch paths that want to degrade locally.
//
// Both log context + a short body sample via @contractor-ops/logger on failure
// (never the full body — OAuth bodies contain client_secret / tokens).

import { createIntegrationLogger } from '@contractor-ops/logger';
import type { ZodType, z } from 'zod';

/** First N chars of an unexpected body to include in failure logs. */
const ERROR_BODY_SAMPLE_LEN = 200;

const log = createIntegrationLogger('http');

/**
 * Thrown when an external HTTP response body cannot be read, is not valid
 * JSON, or fails its Zod schema. Carries `ctx` (a stable call-site tag like
 * `'slack:exchangeCodeForTokens'`) and a `kind` so callers can branch.
 *
 * `cause` holds the underlying error (SyntaxError, ZodError) for debugging;
 * the message intentionally omits the raw body so secrets are never thrown
 * up the stack.
 */
export class ResponseValidationError extends Error {
  public readonly ctx: string;
  public readonly kind: 'read' | 'json' | 'schema';

  constructor(ctx: string, kind: 'read' | 'json' | 'schema', cause?: unknown) {
    super(`${ctx}: response ${kind} validation failed`);
    this.name = 'ResponseValidationError';
    this.ctx = ctx;
    this.kind = kind;
    if (cause !== undefined) this.cause = cause;
  }
}

export type SafeParseJsonResult<T> =
  | { success: true; data: T }
  | { success: false; error: ResponseValidationError };

/**
 * Read `res` as text, JSON.parse it, then validate against `schema`.
 *
 * On any failure (body read, non-JSON, schema mismatch) returns a typed
 * failure result instead of throwing. Use on transient data-fetch paths
 * (lists, status polls) where a bad parse should fail locally, not crash.
 *
 * @param res - the fetch Response (body must be unread)
 * @param schema - Zod schema describing only the fields the caller reads
 * @param ctx - stable call-site tag for logs (e.g. `'jira:listProjects'`)
 */
export async function safeParseJsonResponse<S extends ZodType>(
  res: Response,
  schema: S,
  ctx: string,
): Promise<SafeParseJsonResult<z.infer<S>>> {
  let raw: string;
  try {
    raw = await res.text();
  } catch (err) {
    log.warn({ ctx, status: res.status }, 'response body read failed');
    return { success: false, error: new ResponseValidationError(ctx, 'read', err) };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    log.warn(
      { ctx, status: res.status, sample: raw.slice(0, ERROR_BODY_SAMPLE_LEN) },
      'response body is not valid JSON',
    );
    return { success: false, error: new ResponseValidationError(ctx, 'json', err) };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    // Log Zod issue paths only — never the parsed body (may carry secrets).
    log.warn(
      { ctx, status: res.status, issues: parsed.error.issues.map(i => i.path.join('.')) },
      'response failed schema validation',
    );
    return { success: false, error: new ResponseValidationError(ctx, 'schema', parsed.error) };
  }

  return { success: true, data: parsed.data };
}

/**
 * Read `res` as text, JSON.parse it, then validate against `schema`,
 * THROWING `ResponseValidationError` on any failure (fail closed).
 *
 * Use at credential-persist boundaries (OAuth `exchangeCodeForTokens` /
 * `refreshToken`): a malformed token response must throw so the corrupt value
 * never reaches `encryptCredentials` / `IntegrationConnection.credentialsRef`.
 *
 * @param res - the fetch Response (body must be unread)
 * @param schema - Zod schema describing only the fields the caller reads
 * @param ctx - stable call-site tag for logs (e.g. `'slack:exchangeCodeForTokens'`)
 */
export async function parseJsonResponse<S extends ZodType>(
  res: Response,
  schema: S,
  ctx: string,
): Promise<z.infer<S>> {
  const result = await safeParseJsonResponse(res, schema, ctx);
  if (!result.success) throw result.error;
  return result.data;
}
