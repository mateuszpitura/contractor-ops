/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock("@contractor-ops/db", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

import { GET } from "../route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw.mockResolvedValue(undefined);
  });

  it("returns 200 ok when database query succeeds", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; timestamp: string };
    expect(json.status).toBe("ok");
    expect(json.timestamp).toMatch(/^\d{4}-/);
    expect(mockQueryRaw).toHaveBeenCalled();
  });

  it("returns 503 when database query fails", async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(503);
    const json = (await res.json()) as { status: string; message: string };
    expect(json.status).toBe("error");
    expect(json.message).toBe("Database connection failed");
  });
});
