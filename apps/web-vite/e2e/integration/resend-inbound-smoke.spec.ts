import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Resend inbound webhook smoke — ported from
// apps/web/e2e/integration/resend-inbound-smoke.spec.ts (Step 13).
//
// New stack target: Fastify `POST /webhooks/:provider` dispatcher in
// apps/api/src/routes/webhooks/multi-provider.ts, called with the `resend`
// slug. Legacy path was `/api/webhooks/resend` on the Next SPA origin;
// Fastify drops the `/api` prefix and serves the route on the API origin.
//
// Without a valid Svix signature the dispatcher returns 401
// `{ error: 'Invalid signature' }`. The legacy assertion matched on
// `signature|Missing` — the new route returns the literal "Invalid
// signature", so the regex is updated accordingly.
// ---------------------------------------------------------------------------

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:4000';
const ENDPOINT = `${API_BASE}/webhooks/resend`;

test.describe('Resend inbound (optional E2E)', () => {
  test.skip(
    process.env.RUN_RESEND_E2E !== '1',
    'Set RUN_RESEND_E2E=1 and start the app; optional E2E_API_URL overrides API base URL (see .env.example).',
  );

  test('POST without Svix headers returns 401 (handler reachable)', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: '{}',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBe(401);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/invalid signature|signature|missing/i);
  });
});
