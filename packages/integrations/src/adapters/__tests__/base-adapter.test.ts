import { describe, expect, it } from "vitest";
import { BaseAdapter } from "../base-adapter.js";

/**
 * Minimal concrete adapter for exercising the base class contract.
 */
class TestAdapter extends BaseAdapter {
  readonly slug = "test";
  readonly displayName = "Test";
  readonly supportsOAuth = false;
  readonly supportsWebhooks = false;
}

describe("BaseAdapter", () => {
  it("can be extended with required abstract fields", () => {
    const a = new TestAdapter();
    expect(a.slug).toBe("test");
    expect(a.displayName).toBe("Test");
    expect(a.supportsOAuth).toBe(false);
    expect(a.supportsWebhooks).toBe(false);
  });

  it("does not define optional adapter methods on a minimal subclass", () => {
    const a = new TestAdapter();
    expect(a.getOAuthConfig).toBeUndefined();
    expect(a.exchangeCodeForTokens).toBeUndefined();
    expect(a.refreshToken).toBeUndefined();
    expect(a.verifyWebhookSignature).toBeUndefined();
    expect(a.handleWebhook).toBeUndefined();
    expect(a.getHealthStatus).toBeUndefined();
  });
});
