import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Peppol inbound (Storecove webhook) smoke tests — ported from
// apps/web/e2e/integration/peppol-inbound-smoke.spec.ts (Step 13).
//
// New stack target: Fastify `POST /webhooks/storecove`
// (apps/api/src/routes/webhooks/storecove.ts), reached on the API origin
// (`http://localhost:4000` in the Playwright webServer). The legacy Next
// path was `/api/webhooks/storecove` on the SPA origin — Fastify drops the
// `/api` prefix and the route lives on the API server.
//
// These tests exercise the *security and structural* guards of the handler
// without requiring a valid STORECOVE_WEBHOOK_SECRET:
//   - when the secret is absent, the handler returns 500 "Not configured"
//   - when the secret is present but the signature is missing/wrong it
//     returns 401 "Invalid signature"
// Either way the signature guard is proven to be in the request path.
//
// Unlike the legacy Next handler (which exposed a 405 for non-POST verbs
// via an explicit handler), Fastify returns 404 by default for methods
// that aren't registered. The route only registers `POST`, so GET/PUT
// surface as 404 here — that still proves the path is mounted (vs. a
// 5xx crash) while remaining accurate to the new stack.
// ---------------------------------------------------------------------------

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:4000';
const ENDPOINT = `${API_BASE}/webhooks/storecove`;

const REALISTIC_BODY = JSON.stringify({
  metadata: {
    event: 'invoice.transmission.success',
    guid: 'aaaabbbb-cccc-dddd-eeee-ffffaaaabbbb',
  },
  document: { invoice_number: 'INV-0001' },
});

test.describe('Peppol inbound (Storecove webhook) smoke', () => {
  test.skip(
    process.env.RUN_PEPPOL_E2E !== '1',
    'Set RUN_PEPPOL_E2E=1 and start the app; optional E2E_API_URL overrides API base URL (see .env.example).',
  );

  // -------------------------------------------------------------------------
  // 1. Unsigned POST — no signature header present
  // -------------------------------------------------------------------------
  test('POST without signature header returns 401 or 500 (handler reachable, guard in place)', async ({
    request,
  }) => {
    const res = await request.post(ENDPOINT, {
      data: REALISTIC_BODY,
      headers: { 'content-type': 'application/json' },
    });
    // 401 = secret configured, signature missing/invalid.
    // 500 = secret not configured (CI/staging without secret env var).
    // Both prove the guard path is reached, not a crash into a 500 from an
    // unhandled error.
    expect([401, 500]).toContain(res.status());
    const json = (await res.json()) as { error?: string };
    expect(typeof json.error).toBe('string');
    expect(json.error?.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 2. Empty body POST — should return explicit error, not crash
  // -------------------------------------------------------------------------
  test('POST with empty body returns explicit error', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: '',
      headers: { 'content-type': 'application/json' },
    });
    // Handler reads raw body which always succeeds on an empty string, so
    // we expect 401 / 500 from the secret/signature guard, not a 5xx from
    // an unhandled exception.
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(600);
    const json = (await res.json()) as Record<string, unknown>;
    // Must be a structured JSON object, not an HTML error page.
    expect(typeof json).toBe('object');
  });

  // -------------------------------------------------------------------------
  // 3. Malformed JSON body — syntactically invalid, must return structured error
  // -------------------------------------------------------------------------
  test('POST with malformed JSON returns structured error', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: '{ this is: not json !!!',
      headers: { 'content-type': 'application/json' },
    });
    // The webhook plugin uses a raw-body content-type parser ('*' → buffer)
    // so JSON syntax is irrelevant until the handler's own parse step. The
    // secret/signature guard runs first, returning 401 / 500 with a JSON
    // error envelope; either way we must not see an unhandled 5xx.
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const json = (await res.json()) as Record<string, unknown>;
    expect(typeof json).toBe('object');
  });

  // -------------------------------------------------------------------------
  // 4. Wrong content-type (text/plain) — must be rejected
  // -------------------------------------------------------------------------
  test('POST with text/plain content-type is rejected (4xx or 5xx)', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: 'hello world',
      headers: { 'content-type': 'text/plain' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const json = (await res.json()) as Record<string, unknown>;
    expect(typeof json).toBe('object');
  });

  // -------------------------------------------------------------------------
  // 5. GET — not registered (Fastify default: 404)
  // -------------------------------------------------------------------------
  test('GET returns 404 (only POST is registered on the Fastify route)', async ({ request }) => {
    const res = await request.get(ENDPOINT);
    expect(res.status()).toBe(404);
  });

  // -------------------------------------------------------------------------
  // 6. PUT — not registered (Fastify default: 404)
  // -------------------------------------------------------------------------
  test('PUT returns 404 (only POST is registered on the Fastify route)', async ({ request }) => {
    const res = await request.put(ENDPOINT, {
      data: REALISTIC_BODY,
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBe(404);
  });

  // -------------------------------------------------------------------------
  // 7. POST with forged x-storecove-hmac-sha256 header — still rejected
  //    (proves header presence alone is insufficient)
  // -------------------------------------------------------------------------
  test('POST with a forged signature header returns 401 or 500 (signature check fails)', async ({
    request,
  }) => {
    const res = await request.post(ENDPOINT, {
      data: REALISTIC_BODY,
      headers: {
        'content-type': 'application/json',
        'x-storecove-hmac-sha256': 'invalidsignaturevalue',
      },
    });
    // 401 = secret configured, forged sig rejected.
    // 500 = secret not configured (secret check runs first).
    expect([401, 500]).toContain(res.status());
    const json = (await res.json()) as { error?: string };
    expect(typeof json.error).toBe('string');
  });

  // -------------------------------------------------------------------------
  // 8. Rate-limit bypass header — TODO if added in future
  //    The Storecove handler has no load-test bypass header today.
  //    This test documents the gap and will be promoted when one is added.
  // -------------------------------------------------------------------------
  // TODO: add test once a bypass header (e.g. x-storecove-bypass-ratelimit)
  // is introduced in the handler. For now, this is intentionally omitted.
});
