import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("../zatca-hash-chain.js", () => ({
  acquireChainLock: vi.fn().mockResolvedValue(undefined),
  getNextChainEntry: vi.fn().mockResolvedValue({ icv: 1, pih: "genesis-hash" }),
  recordChainEntry: vi.fn().mockResolvedValue({ id: "chain_1" }),
}));

describe("zatca-submission", () => {
  it("submitToZatca function exists and is exported", async () => {
    const mod = await import("../zatca-submission.js");
    expect(typeof mod.submitToZatca).toBe("function");
  });

  it("handleZatcaSubmissionJob function exists and is exported", async () => {
    const mod = await import("../zatca-submission.js");
    expect(typeof mod.handleZatcaSubmissionJob).toBe("function");
  });
});
