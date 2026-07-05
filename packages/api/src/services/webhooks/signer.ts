/**
 * Outbound webhook HMAC-SHA256 signer — the authenticity + integrity + replay
 * control for every delivery.
 *
 * Header (Stripe convention): `X-CO-Signature: t={unix_ms},v1={hex}` where
 * `v1 = HMAC_SHA256(secret, "{t}.{rawBody}")`. Binding the timestamp into the
 * signed string means a captured body cannot be replayed outside a 5-minute
 * window: a verifier rejects `|now - t| > 300_000` ms BEFORE the constant-time
 * digest compare. Mirrors the inbound verify idiom (storecove/inpost/linear):
 * `createHmac('sha256', secret).update(signed).digest('hex')` + `timingSafeEqual`.
 *
 * The per-subscription secret is recoverable (we re-sign every delivery), so it
 * is stored encrypted at rest (100-08), never one-way hashed like an API key.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOLERANCE_MS = 300_000; // 5 minutes
const HEX64 = /^[0-9a-f]{64}$/i;

export interface SignedWebhook {
  /** `t={ms},v1={hex}` — the `X-CO-Signature` header value. */
  header: string;
  t: number;
  v1: string;
}

/** Mint a per-subscription secret: `whsec_` + 256 bits of hex. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString('hex')}`;
}

/** Sign a raw body at time `tMs` with the subscription secret. */
export function signWebhookPayload(
  secret: string,
  rawBody: string,
  tMs: number = Date.now(),
): SignedWebhook {
  const v1 = createHmac('sha256', secret).update(`${tMs}.${rawBody}`).digest('hex');
  return { header: `t=${tMs},v1=${v1}`, t: tMs, v1 };
}

interface ParsedSignature {
  t: number;
  v1: string;
}

function parseSignatureHeader(header: string): ParsedSignature | null {
  if (typeof header !== 'string') return null;
  let t: number | undefined;
  let v1: string | undefined;
  for (const segment of header.split(',')) {
    const eq = segment.indexOf('=');
    if (eq === -1) continue;
    const key = segment.slice(0, eq).trim();
    const value = segment.slice(eq + 1).trim();
    if (key === 't') t = Number(value);
    else if (key === 'v1') v1 = value;
  }
  if (t === undefined || v1 === undefined) return null;
  if (!(Number.isFinite(t) && HEX64.test(v1))) return null;
  return { t, v1 };
}

export interface VerifyOptions {
  nowMs?: number;
  toleranceMs?: number;
}

/**
 * Verify an `X-CO-Signature` header against the raw body with the shared
 * secret. Rejects a timestamp outside the tolerance window BEFORE the
 * constant-time compare, so a stale replay never reaches the digest check.
 */
export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  header: string,
  opts: VerifyOptions = {},
): boolean {
  const nowMs = opts.nowMs ?? Date.now();
  const toleranceMs = opts.toleranceMs ?? DEFAULT_TOLERANCE_MS;

  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;
  if (Math.abs(nowMs - parsed.t) > toleranceMs) return false;

  const expected = createHmac('sha256', secret).update(`${parsed.t}.${rawBody}`).digest('hex');
  const provided = Buffer.from(parsed.v1, 'hex');
  const computed = Buffer.from(expected, 'hex');
  if (provided.length !== computed.length) return false;
  return timingSafeEqual(provided, computed);
}
