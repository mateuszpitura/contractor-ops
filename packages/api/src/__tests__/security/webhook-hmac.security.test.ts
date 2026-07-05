/**
 * RED security net — INTEG-WEBHOOK-04 / INTEG-WEBHOOK-05 (HMAC signature + replay window).
 * Turned GREEN by 100-03 (`services/webhooks/signer.ts` + the sample verifiers).
 *
 * Every delivery carries `X-CO-Signature: t={unix_ms},v1={hex}` where
 * `v1 = HMAC_SHA256(secret, "{t}.{rawBody}")`. A subscriber verifies with its
 * per-subscription secret and MUST reject a signature whose timestamp falls
 * outside a 5-minute window BEFORE the constant-time digest compare, so a
 * captured body cannot be replayed. The digest compare is constant-time.
 */

import { describe, expect, it } from 'vitest';

const SIGNER_MODULE = '../../services/webhooks/signer';

const SECRET = 'whsec_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd';
const BODY = JSON.stringify({ id: 'evt_1', type: 'invoice.paid', data: { amount: 100 } });
const T = 1_751_731_200_000;
const FIVE_MIN = 300_000;

describe('signWebhookPayload — Stripe-convention header (INTEG-WEBHOOK-04)', () => {
  it('produces t={ms},v1={64-hex} from HMAC_SHA256 over "{t}.{body}"', async () => {
    const { signWebhookPayload } = await import(SIGNER_MODULE);
    const { header, t, v1 } = signWebhookPayload(SECRET, BODY, T);
    expect(t).toBe(T);
    expect(header).toBe(`t=${T},v1=${v1}`);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it('never surfaces the secret in the returned header', async () => {
    const { signWebhookPayload } = await import(SIGNER_MODULE);
    const { header } = signWebhookPayload(SECRET, BODY, T);
    expect(header).not.toContain(SECRET);
  });
});

describe('verifyWebhookSignature — authenticity + replay (INTEG-WEBHOOK-05)', () => {
  it('verifies a fresh signature with the right secret', async () => {
    const { signWebhookPayload, verifyWebhookSignature } = await import(SIGNER_MODULE);
    const { header } = signWebhookPayload(SECRET, BODY, T);
    expect(verifyWebhookSignature(SECRET, BODY, header, { nowMs: T })).toBe(true);
  });

  it('rejects a signature made with the wrong secret', async () => {
    const { signWebhookPayload, verifyWebhookSignature } = await import(SIGNER_MODULE);
    const { header } = signWebhookPayload(SECRET, BODY, T);
    expect(verifyWebhookSignature(`${SECRET}x`, BODY, header, { nowMs: T })).toBe(false);
  });

  it('rejects a tampered body', async () => {
    const { signWebhookPayload, verifyWebhookSignature } = await import(SIGNER_MODULE);
    const { header } = signWebhookPayload(SECRET, BODY, T);
    expect(verifyWebhookSignature(SECRET, `${BODY} `, header, { nowMs: T })).toBe(false);
  });

  it('rejects a timestamp older than the 5-minute window', async () => {
    const { signWebhookPayload, verifyWebhookSignature } = await import(SIGNER_MODULE);
    const { header } = signWebhookPayload(SECRET, BODY, T);
    expect(verifyWebhookSignature(SECRET, BODY, header, { nowMs: T + FIVE_MIN + 1 })).toBe(false);
  });

  it('rejects a timestamp too far in the future (clock-skew abuse)', async () => {
    const { signWebhookPayload, verifyWebhookSignature } = await import(SIGNER_MODULE);
    const { header } = signWebhookPayload(SECRET, BODY, T);
    expect(verifyWebhookSignature(SECRET, BODY, header, { nowMs: T - FIVE_MIN - 1 })).toBe(false);
  });

  it('rejects a malformed header shape', async () => {
    const { verifyWebhookSignature } = await import(SIGNER_MODULE);
    expect(verifyWebhookSignature(SECRET, BODY, 'not-a-signature', { nowMs: T })).toBe(false);
  });
});

describe('generateWebhookSecret — per-subscription secret (INTEG-WEBHOOK-04)', () => {
  it('mints whsec_ + 64 hex chars (256-bit) and is unique per call', async () => {
    const { generateWebhookSecret } = await import(SIGNER_MODULE);
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe('shipped TS verifier round-trip — drift guard (INTEG-WEBHOOK-05)', () => {
  // Non-literal import path so tsc does not pull the docs verifier into the api
  // program; vitest resolves it at runtime. Proves the documented verifier the
  // subscriber copies cannot drift from the live signer.
  const verifierUrl = new URL(
    '../../../../../apps/public-api/docs/webhooks/verifiers/verify.ts',
    import.meta.url,
  ).href;

  async function loadDocVerifier() {
    const mod = (await import(verifierUrl)) as {
      verifyWebhookSignature: (
        secret: string,
        rawBody: string,
        header: string,
        nowMs?: number,
      ) => boolean;
    };
    return mod.verifyWebhookSignature;
  }

  it('accepts a fresh signWebhookPayload output', async () => {
    const { signWebhookPayload } = await import(SIGNER_MODULE);
    const docVerify = await loadDocVerifier();
    const { header } = signWebhookPayload(SECRET, BODY, T);
    expect(docVerify(SECRET, BODY, header, T)).toBe(true);
  });

  it('rejects a stale timestamp and a tampered body', async () => {
    const { signWebhookPayload } = await import(SIGNER_MODULE);
    const docVerify = await loadDocVerifier();
    const { header } = signWebhookPayload(SECRET, BODY, T);
    expect(docVerify(SECRET, BODY, header, T + FIVE_MIN + 1)).toBe(false);
    expect(docVerify(SECRET, `${BODY} `, header, T)).toBe(false);
  });
});
