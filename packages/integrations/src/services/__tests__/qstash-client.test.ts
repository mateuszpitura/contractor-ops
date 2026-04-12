import { beforeEach, describe, expect, it, vi } from "vitest";
import { getQStashClient, resetQStashClient } from "../qstash-client.js";

const { MockClient } = vi.hoisted(() => {
  class MockClient {}
  return { MockClient };
});

vi.mock("@upstash/qstash", () => ({
  Client: MockClient,
}));

describe("qstash-client", () => {
  beforeEach(() => {
    resetQStashClient();
    delete process.env.QSTASH_TOKEN;
    vi.clearAllMocks();
  });

  it("throws when QSTASH_TOKEN is not set", () => {
    expect(() => getQStashClient()).toThrow("QSTASH_TOKEN");
  });

  it("constructs a singleton client when token is set", () => {
    process.env.QSTASH_TOKEN = "test-token";

    const a = getQStashClient();
    const b = getQStashClient();

    expect(a).toBe(b);
    expect(a).toBeInstanceOf(MockClient);
  });

  it("resetQStashClient allows a new client after env change", () => {
    process.env.QSTASH_TOKEN = "t1";
    const c1 = getQStashClient();
    resetQStashClient();
    process.env.QSTASH_TOKEN = "t2";
    const c2 = getQStashClient();
    expect(c1).not.toBe(c2);
  });
});
