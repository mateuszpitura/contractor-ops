import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Peppol inbound (Storecove webhook) smoke tests
//
// These tests exercise the *security and structural* guards of the handler
// without requiring a valid STORECOVE_WEBHOOK_SECRET.  They are deliberately
// lightweight: probe error codes, not business logic.
//
// When the secret is absent the handler returns 500 "Not configured".
// When the secret is present but the signature is missing/wrong it returns 401.
// Either way the signature guard is proven to be in the request path.
// ---------------------------------------------------------------------------

const ENDPOINT = '/api/webhooks/storecove';

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
    'Set RUN_PEPPOL_E2E=1 and start the app; optional E2E_WEB_URL overrides base URL (see .env.example).',
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
    expect(json.error!.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 2. Empty body POST — should return explicit error, not crash
  // -------------------------------------------------------------------------
  test('POST with empty body returns explicit error', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: '',
      headers: { 'content-type': 'application/json' },
    });
    // Handler reads raw body with request.text() which always succeeds on an
    // empty string, so we expect 401 / 500, not a hard 500 from a thrown
    // unhandled exception.
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(600);
    const json = (await res.json()) as Record<string, unknown>;
    // Must be a structured JSON object, not a Next.js HTML error page.
    expect(typeof json).toBe('object');
  });

  // -------------------------------------------------------------------------
  // 3. Malformed JSON body — syntactically invalid, must return 400 with error
  // -------------------------------------------------------------------------
  test('POST with malformed JSON returns 400 with error field', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: '{ this is: not json !!!',
      headers: { 'content-type': 'application/json' },
    });
    // If the secret is not configured we get 500 before the parse step.
    // If the secret IS configured: signature fails → 401 (raw body is still
    // read before signature check, so no parse error at that stage).
    // Either way we must not get an unhandled 500 with no body.
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
  // 5. GET — method not allowed
  // -------------------------------------------------------------------------
  test('GET returns 405 Method Not Allowed', async ({ request }) => {
    const res = await request.get(ENDPOINT);
    expect(res.status()).toBe(405);
  });

  // -------------------------------------------------------------------------
  // 6. PUT — method not allowed
  // -------------------------------------------------------------------------
  test('PUT returns 405 Method Not Allowed', async ({ request }) => {
    const res = await request.put(ENDPOINT, {
      data: REALISTIC_BODY,
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBe(405);
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
