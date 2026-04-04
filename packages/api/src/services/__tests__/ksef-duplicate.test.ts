import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkCrossSourceDuplicate,
  linkDuplicateInvoices,
} from "../ksef-duplicate-detection.js";

const mockPrisma = {
  invoice: {
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
} as any;

const ORG_ID = "org-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkCrossSourceDuplicate", () => {
  it("finds duplicate by invoiceNumber + sellerTaxId", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: "inv-existing",
      source: "MANUAL",
    });

    const result = await checkCrossSourceDuplicate(
      mockPrisma,
      ORG_ID,
      "FV/2026/001",
      "1234567890",
    );

    expect(result.isDuplicate).toBe(true);
    expect(result.existingInvoiceId).toBe("inv-existing");
    expect(result.existingSource).toBe("MANUAL");
  });

  it("returns no duplicate when none exists", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    const result = await checkCrossSourceDuplicate(
      mockPrisma,
      ORG_ID,
      "FV/2026/999",
      "9999999999",
    );

    expect(result.isDuplicate).toBe(false);
    expect(result.existingInvoiceId).toBeNull();
    expect(result.existingSource).toBeNull();
  });

  it("excludes specified invoice ID from search", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    await checkCrossSourceDuplicate(
      mockPrisma,
      ORG_ID,
      "FV/2026/001",
      "1234567890",
      "inv-self",
    );

    const whereArg = mockPrisma.invoice.findFirst.mock.calls[0][0].where;
    expect(whereArg.id).toEqual({ not: "inv-self" });
  });

  it("returns existingSource from the matched invoice", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: "inv-ksef",
      source: "KSEF",
    });

    const result = await checkCrossSourceDuplicate(
      mockPrisma,
      ORG_ID,
      "FV/2026/002",
      "5555555555",
    );

    expect(result.existingSource).toBe("KSEF");
  });
});

describe("linkDuplicateInvoices", () => {
  it("flags both invoices with duplicate metadata in flagsJson", async () => {
    mockPrisma.invoice.findUniqueOrThrow
      .mockResolvedValueOnce({ flagsJson: null })
      .mockResolvedValueOnce({ flagsJson: null });
    mockPrisma.invoice.update.mockResolvedValue({});

    await linkDuplicateInvoices(mockPrisma, "inv-ksef", "inv-manual");

    expect(mockPrisma.invoice.update).toHaveBeenCalledTimes(2);

    const ksefUpdateCall = mockPrisma.invoice.update.mock.calls.find(
      (c: any) => c[0].where.id === "inv-ksef",
    );
    const manualUpdateCall = mockPrisma.invoice.update.mock.calls.find(
      (c: any) => c[0].where.id === "inv-manual",
    );

    expect(ksefUpdateCall[0].data.flagsJson).toEqual(
      expect.objectContaining({
        duplicateOf: "inv-manual",
      }),
    );
    expect(manualUpdateCall[0].data.flagsJson).toEqual(
      expect.objectContaining({
        duplicateOf: "inv-ksef",
      }),
    );
  });

  it("preserves existing flagsJson when adding duplicate link", async () => {
    mockPrisma.invoice.findUniqueOrThrow
      .mockResolvedValueOnce({
        flagsJson: { existingFlag: true, priority: "high" },
      })
      .mockResolvedValueOnce({
        flagsJson: { reviewed: true },
      });
    mockPrisma.invoice.update.mockResolvedValue({});

    await linkDuplicateInvoices(mockPrisma, "inv-ksef", "inv-manual");

    const ksefUpdateCall = mockPrisma.invoice.update.mock.calls.find(
      (c: any) => c[0].where.id === "inv-ksef",
    );
    const manualUpdateCall = mockPrisma.invoice.update.mock.calls.find(
      (c: any) => c[0].where.id === "inv-manual",
    );

    expect(ksefUpdateCall[0].data.flagsJson).toEqual(
      expect.objectContaining({
        existingFlag: true,
        priority: "high",
        duplicateOf: "inv-manual",
      }),
    );
    expect(manualUpdateCall[0].data.flagsJson).toEqual(
      expect.objectContaining({
        reviewed: true,
        duplicateOf: "inv-ksef",
      }),
    );
  });

  it("sets KSeF invoice duplicateSource to MANUAL and manual to KSEF", async () => {
    mockPrisma.invoice.findUniqueOrThrow
      .mockResolvedValueOnce({ flagsJson: null })
      .mockResolvedValueOnce({ flagsJson: null });
    mockPrisma.invoice.update.mockResolvedValue({});

    await linkDuplicateInvoices(mockPrisma, "inv-ksef", "inv-manual");

    const ksefUpdateCall = mockPrisma.invoice.update.mock.calls.find(
      (c: any) => c[0].where.id === "inv-ksef",
    );
    const manualUpdateCall = mockPrisma.invoice.update.mock.calls.find(
      (c: any) => c[0].where.id === "inv-manual",
    );

    expect(ksefUpdateCall[0].data.flagsJson.duplicateSource).toBe("MANUAL");
    expect(manualUpdateCall[0].data.flagsJson.duplicateSource).toBe("KSEF");
  });
});
