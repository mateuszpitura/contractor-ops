import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockExecuteRawUnsafe = vi.fn();
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();

const mockPrisma = {
  $executeRawUnsafe: mockExecuteRawUnsafe,
  zatcaInvoiceChain: {
    findFirst: mockFindFirst,
    create: mockCreate,
  },
};

describe("zatca-hash-chain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getNextChainEntry returns icv=1, PIH=SHA-256('0') for first invoice", async () => {
    const { getNextChainEntry } = await import("../zatca-hash-chain.js");

    // No existing chain entries
    mockFindFirst.mockResolvedValue(null);

    const entry = await getNextChainEntry(mockPrisma as any, "org_test123");

    expect(entry.icv).toBe(1);
    // SHA-256 of literal string "0"
    const expectedPih = crypto.createHash("sha256").update("0").digest("hex");
    expect(entry.pih).toBe(expectedPih);
  });

  it("getNextChainEntry returns icv=N+1, PIH=last hash for subsequent", async () => {
    const { getNextChainEntry } = await import("../zatca-hash-chain.js");

    const lastHash = "abc123def456";
    mockFindFirst.mockResolvedValue({
      icv: 5,
      invoiceHash: lastHash,
    });

    const entry = await getNextChainEntry(mockPrisma as any, "org_test123");

    expect(entry.icv).toBe(6);
    expect(entry.pih).toBe(lastHash);
  });

  it("acquireChainLock uses pg_advisory_xact_lock", async () => {
    const { acquireChainLock } = await import("../zatca-hash-chain.js");

    mockExecuteRawUnsafe.mockResolvedValue(undefined);

    await acquireChainLock(mockPrisma as any, "org_test123");

    expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_xact_lock"),
      "org_test123",
    );
  });

  it("recordChainEntry creates a ZatcaInvoiceChain with PENDING status", async () => {
    const { recordChainEntry } = await import("../zatca-hash-chain.js");

    mockCreate.mockResolvedValue({ id: "chain_1" });

    const data = {
      organizationId: "org_test123",
      icv: 1,
      invoiceId: "inv_1",
      invoiceHash: "hash123",
      previousHash: "prev_hash",
      zatcaUuid: "uuid-v4-here",
    };

    await recordChainEntry(mockPrisma as any, data);

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org_test123",
        icv: 1,
        invoiceId: "inv_1",
        invoiceHash: "hash123",
        previousHash: "prev_hash",
        zatcaUuid: "uuid-v4-here",
        zatcaStatus: "PENDING",
      }),
    });
  });
});
