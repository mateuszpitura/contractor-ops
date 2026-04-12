/**
 * Virus scanner — ClamAV stream scan + availability probe.
 * `clamscan` is fully mocked (no real daemon).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockScanStream } = vi.hoisted(() => ({
  mockScanStream: vi.fn(async () => ({
    isInfected: false,
    viruses: [] as string[],
  })),
}));

vi.mock("clamscan", () => ({
  default: class NodeClam {
    async init() {
      return {
        scanStream: mockScanStream,
      };
    }
  },
}));

import { isClamAvailable, scanBuffer } from "../virus-scanner.js";

describe("virus-scanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockScanStream.mockResolvedValue({
      isInfected: false,
      viruses: [],
    });
  });

  it("scanBuffer reports clean when scanStream finds no infection", async () => {
    const out = await scanBuffer(Buffer.from("hello"));

    expect(out.isClean).toBe(true);
    expect(out.virusName).toBeUndefined();
    expect(mockScanStream).toHaveBeenCalled();
  });

  it("scanBuffer returns virus name when infected", async () => {
    mockScanStream.mockResolvedValueOnce({
      isInfected: true,
      viruses: ["Test.Virus"],
    });

    const out = await scanBuffer(Buffer.from("bad"));

    expect(out.isClean).toBe(false);
    expect(out.virusName).toBe("Test.Virus");
  });

  it("scanBuffer rethrows when scanStream fails", async () => {
    mockScanStream.mockRejectedValueOnce(new Error("clamd down"));

    await expect(scanBuffer(Buffer.from("x"))).rejects.toThrow("clamd down");
  });

  it("isClamAvailable returns true when init succeeds", async () => {
    await expect(isClamAvailable()).resolves.toBe(true);
  });
});
