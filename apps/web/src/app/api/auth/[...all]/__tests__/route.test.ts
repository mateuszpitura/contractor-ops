/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("@contractor-ops/auth", () => ({
  auth: {},
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: vi.fn(() => ({
    GET: mockGet,
    POST: mockPost,
  })),
}));

describe("/api/auth/[...all] route", () => {
  it("re-exports GET and POST from toNextJsHandler(auth)", async () => {
    const { GET, POST } = await import("../route.js");

    expect(GET).toBe(mockGet);
    expect(POST).toBe(mockPost);
    const { toNextJsHandler } = await import("better-auth/next-js");
    expect(vi.mocked(toNextJsHandler)).toHaveBeenCalled();
  });
});
