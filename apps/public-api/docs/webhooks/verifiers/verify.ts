/**
 * Reference verifier for Contractor Ops outbound webhooks (TypeScript / Node.js).
 *
 * Each delivery carries `X-CO-Signature: t={unix_ms},v1={hex}` where
 *   v1 = HMAC_SHA256(secret, `${t}.${rawBody}`)  (hex).
 *
 * Verify with the per-subscription secret shown once at creation. Reject any
 * signature whose timestamp is outside a 5-minute window BEFORE comparing the
 * digest — this is your replay protection. Compare in constant time.
 *
 * Dependency-free: Node.js stdlib `crypto` only.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string,
  nowMs: number = Date.now(),
  toleranceMs: number = FIVE_MINUTES_MS,
): boolean {
  let t: number | undefined;
  let v1: string | undefined;
  for (const part of signatureHeader.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') t = Number(value);
    else if (key === 'v1') v1 = value;
  }
  if (t === undefined || v1 === undefined || !Number.isFinite(t) || !/^[0-9a-f]{64}$/i.test(v1)) {
    return false;
  }

  // Replay window — reject stale/future timestamps BEFORE the digest compare.
  if (Math.abs(nowMs - t) > toleranceMs) return false;

  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(v1, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
