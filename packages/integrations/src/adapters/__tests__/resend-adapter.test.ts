import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResendAdapter } from "../resend-adapter.js";

const { mockVerify } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    webhooks = {
      verify: (...args: unknown[]) => mockVerify(...args),
    };
  },
}));

describe("ResendAdapter", () => {
  let adapter: ResendAdapter;

  beforeEach(() => {
    adapter = new ResendAdapter();
    vi.clearAllMocks();
    delete process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.RESEND_API_KEY;
  });

  it("does not support OAuth", () => {
    expect(adapter.supportsOAuth).toBe(false);
    expect(adapter.supportsWebhooks).toBe(true);
  });

  describe("verifyWebhookSignature", () => {
    it("returns invalid when webhook secret or API key missing", () => {
      const r = adapter.verifyWebhookSignature("{}", {
        "svix-id": "id",
        "svix-timestamp": "1",
        "svix-signature": "sig",
      });
      expect(r.valid).toBe(false);
      expect(mockVerify).not.toHaveBeenCalled();
    });

    it("returns invalid when Svix headers are incomplete", () => {
      process.env.RESEND_WEBHOOK_SECRET = "whsec";
      process.env.RESEND_API_KEY = "re_key";

      const r = adapter.verifyWebhookSignature("{}", { "svix-id": "id" });
      expect(r.valid).toBe(false);
    });

    it("returns valid with event type and org slug hint from recipient", () => {
      process.env.RESEND_WEBHOOK_SECRET = "whsec";
      process.env.RESEND_API_KEY = "re_key";

      mockVerify.mockReturnValue({
        type: "email.received",
        data: { to: ["invoices@acme.contractorhub.io"] },
      });

      const r = adapter.verifyWebhookSignature('{"x":1}', {
        "svix-id": "msg_1",
        "svix-timestamp": "123",
        "svix-signature": "v1,sig",
      });

      expect(r.valid).toBe(true);
      expect(r.eventType).toBe("email.received");
      expect(r.organizationSlug).toBe("acme");
      expect(mockVerify).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: '{"x":1}',
          webhookSecret: "whsec",
        }),
      );
    });

    it("returns invalid when verify throws", () => {
      process.env.RESEND_WEBHOOK_SECRET = "whsec";
      process.env.RESEND_API_KEY = "re_key";
      mockVerify.mockImplementation(() => {
        throw new Error("bad sig");
      });

      const r = adapter.verifyWebhookSignature("{}", {
        "svix-id": "id",
        "svix-timestamp": "1",
        "svix-signature": "sig",
      });

      expect(r.valid).toBe(false);
    });

    it("parses org slug from Display Name <email> recipient format", () => {
      process.env.RESEND_WEBHOOK_SECRET = "whsec";
      process.env.RESEND_API_KEY = "re_key";

      mockVerify.mockReturnValue({
        type: "email.received",
        data: {
          to: ["Invoices <invoices@myorg.contractorhub.io>"],
        },
      });

      const r = adapter.verifyWebhookSignature("{}", {
        "svix-id": "id",
        "svix-timestamp": "1",
        "svix-signature": "sig",
      });

      expect(r.valid).toBe(true);
      expect(r.organizationSlug).toBe("myorg");
    });

    it("uses eventType unknown when verify payload has no type", () => {
      process.env.RESEND_WEBHOOK_SECRET = "whsec";
      process.env.RESEND_API_KEY = "re_key";

      mockVerify.mockReturnValue({
        data: { to: ["invoices@x.contractorhub.io"] },
      });

      const r = adapter.verifyWebhookSignature("{}", {
        "svix-id": "id",
        "svix-timestamp": "1",
        "svix-signature": "sig",
      });

      expect(r.valid).toBe(true);
      expect(r.eventType).toBe("unknown");
      expect(r.organizationSlug).toBe("x");
    });

    it("returns valid without organizationSlug when recipient list is empty", () => {
      process.env.RESEND_WEBHOOK_SECRET = "whsec";
      process.env.RESEND_API_KEY = "re_key";

      mockVerify.mockReturnValue({
        type: "email.received",
        data: { to: [] },
      });

      const r = adapter.verifyWebhookSignature("{}", {
        "svix-id": "id",
        "svix-timestamp": "1",
        "svix-signature": "sig",
      });

      expect(r.valid).toBe(true);
      expect(r.organizationSlug).toBeUndefined();
    });

    it("does not set organizationSlug for non-contractorhub recipient domain", () => {
      process.env.RESEND_WEBHOOK_SECRET = "whsec";
      process.env.RESEND_API_KEY = "re_key";

      mockVerify.mockReturnValue({
        type: "email.received",
        data: { to: ["hi@example.com"] },
      });

      const r = adapter.verifyWebhookSignature("{}", {
        "svix-id": "id",
        "svix-timestamp": "1",
        "svix-signature": "sig",
      });

      expect(r.valid).toBe(true);
      expect(r.organizationSlug).toBeUndefined();
    });
  });
});
