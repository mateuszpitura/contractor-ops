import { describe, it, expect, vi, beforeEach } from "vitest";
import { GovApiAuditLogger } from "../audit-logger.js";
import type { GovApiAuditEntry } from "../types.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GovApiAuditLogger", () => {
  const mockCreate = vi.fn();
  const mockPrisma = {
    govApiAuditLog: {
      create: mockCreate,
    },
  } as unknown as import("@contractor-ops/db").PrismaClient;

  const sampleEntry: GovApiAuditEntry = {
    apiName: "zatca",
    organizationId: "org-1",
    endpoint: "/invoices/report",
    method: "POST",
    requestBodyHash: "abc123",
    responseStatus: 200,
    responseTimeMs: 150,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an audit record with all fields", async () => {
    mockCreate.mockResolvedValue({ id: "log-1" });

    const logger = new GovApiAuditLogger(mockPrisma);
    await logger.log(sampleEntry);

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        apiName: "zatca",
        endpoint: "/invoices/report",
        method: "POST",
        requestBodyHash: "abc123",
        responseStatus: 200,
        responseTimeMs: 150,
        errorMessage: undefined,
      },
    });
  });

  it("includes errorMessage when present", async () => {
    mockCreate.mockResolvedValue({ id: "log-2" });

    const logger = new GovApiAuditLogger(mockPrisma);
    await logger.log({
      ...sampleEntry,
      responseStatus: 500,
      errorMessage: "Internal server error",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        responseStatus: 500,
        errorMessage: "Internal server error",
      }),
    });
  });

  it("catches and swallows write errors", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockCreate.mockRejectedValue(new Error("DB connection failed"));

    const logger = new GovApiAuditLogger(mockPrisma);

    // Should not throw
    await expect(logger.log(sampleEntry)).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[GovApiAuditLogger] Failed to write audit log:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});
