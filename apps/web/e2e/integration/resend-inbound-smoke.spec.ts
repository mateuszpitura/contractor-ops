import { expect, test } from "@playwright/test";

test.describe("Resend inbound (optional E2E)", () => {
  test.skip(
    process.env.RUN_RESEND_E2E !== "1",
    "Set RUN_RESEND_E2E=1 and start the app; optional E2E_WEB_URL overrides base URL (see .env.example).",
  );

  test("POST without Svix headers returns 401 (handler reachable)", async ({ request }) => {
    const res = await request.post("/api/webhooks/resend", {
      data: "{}",
      headers: { "content-type": "application/json" },
    });
    expect(res.status()).toBe(401);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/signature|Missing/i);
  });
});
