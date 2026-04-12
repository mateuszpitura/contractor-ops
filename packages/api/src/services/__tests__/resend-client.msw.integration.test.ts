/**
 * Integration: Resend SDK + MSW handlers for api.resend.com (no SDK mock).
 */

import { createMockServer, selectHandlers } from "@contractor-ops/test-utils";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(["resend"]),
});

beforeAll(() =>
  server.listen({
    onUnhandledRequest: "warn",
  }),
);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("resend-client + MSW", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test_msw_integration";
  });

  it("emails.send receives mock id from MSW", async () => {
    const { getResend } = await import("../resend-client.js");
    const res = await getResend().emails.send({
      from: "onboarding@resend.dev",
      to: ["ops@example.com"],
      subject: "MSW integration",
      html: "<p>ok</p>",
    });

    expect(res.error).toBeNull();
    expect(res.data?.id).toBeDefined();
  });
});
