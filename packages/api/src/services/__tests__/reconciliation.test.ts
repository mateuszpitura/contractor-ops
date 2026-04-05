import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeTimeReconciliation } from "../time-reconciliation.js";

const mockPrisma = {
  contract: { findFirst: vi.fn() },
  timeEntry: { aggregate: vi.fn() },
  organization: { findUniqueOrThrow: vi.fn() },
} as any;

const ORG_ID = "org-1";
const CONTRACT_ID = "contract-1";
const PERIOD_START = new Date("2025-01-01");
const PERIOD_END = new Date("2025-01-31");

function setupMocks(opts: {
  rateType: string;
  rateValueGrosze: number;
  approvedMinutes: number;
  invoicedAmountGrosze: number;
  thresholdPercent?: number;
  hoursPerDay?: number;
}) {
  mockPrisma.contract.findFirst.mockResolvedValue({
    rateType: opts.rateType,
    rateValueGrosze: opts.rateValueGrosze,
  });
  mockPrisma.timeEntry.aggregate.mockResolvedValue({
    _sum: { minutes: opts.approvedMinutes },
  });
  const settings: Record<string, unknown> = {};
  if (opts.thresholdPercent !== undefined) {
    settings.timeDeviationThresholdPercent = opts.thresholdPercent;
  }
  if (opts.hoursPerDay !== undefined) {
    settings.timeHoursPerDay = opts.hoursPerDay;
  }
  mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
    settingsJson: settings,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("reconciliation", () => {
  describe("computeTimeReconciliation", () => {
    it("computes expected amount for PER_HOUR contract: minutes * rate / 60", async () => {
      // 120 minutes at 6000 grosze/hr = 120 * 6000 / 60 = 12000
      setupMocks({
        rateType: "PER_HOUR",
        rateValueGrosze: 6000,
        approvedMinutes: 120,
        invoicedAmountGrosze: 12000,
      });

      const result = await computeTimeReconciliation(
        mockPrisma,
        ORG_ID,
        CONTRACT_ID,
        PERIOD_START,
        PERIOD_END,
        12000,
      );

      expect(result).not.toBeNull();
      expect(result!.expectedAmountGrosze).toBe(12000);
      expect(result!.rateType).toBe("PER_HOUR");
    });

    it("computes expected amount for PER_DAY contract: minutes / (hoursPerDay * 60) * rate", async () => {
      // 480 minutes (8h) at 48000 grosze/day with 8 hrs/day = (480 / 480) * 48000 = 48000
      setupMocks({
        rateType: "PER_DAY",
        rateValueGrosze: 48000,
        approvedMinutes: 480,
        invoicedAmountGrosze: 48000,
        hoursPerDay: 8,
      });

      const result = await computeTimeReconciliation(
        mockPrisma,
        ORG_ID,
        CONTRACT_ID,
        PERIOD_START,
        PERIOD_END,
        48000,
      );

      expect(result).not.toBeNull();
      expect(result!.expectedAmountGrosze).toBe(48000);
      expect(result!.rateType).toBe("PER_DAY");
      expect(result!.hoursPerDay).toBe(8);
    });

    it("returns null for MONTHLY_FIXED contracts", async () => {
      mockPrisma.contract.findFirst.mockResolvedValue({
        rateType: "MONTHLY_FIXED",
        rateValueGrosze: 500000,
      });

      const result = await computeTimeReconciliation(
        mockPrisma,
        ORG_ID,
        CONTRACT_ID,
        PERIOD_START,
        PERIOD_END,
        500000,
      );

      expect(result).toBeNull();
    });

    it("returns null for PER_MILESTONE contracts", async () => {
      mockPrisma.contract.findFirst.mockResolvedValue({
        rateType: "PER_MILESTONE",
        rateValueGrosze: 100000,
      });

      const result = await computeTimeReconciliation(
        mockPrisma,
        ORG_ID,
        CONTRACT_ID,
        PERIOD_START,
        PERIOD_END,
        100000,
      );

      expect(result).toBeNull();
    });

    it("returns null when no approved time entries exist", async () => {
      setupMocks({
        rateType: "PER_HOUR",
        rateValueGrosze: 6000,
        approvedMinutes: 0,
        invoicedAmountGrosze: 12000,
      });

      const result = await computeTimeReconciliation(
        mockPrisma,
        ORG_ID,
        CONTRACT_ID,
        PERIOD_START,
        PERIOD_END,
        12000,
      );

      expect(result).toBeNull();
    });

    it("only counts entries from APPROVED timesheets", async () => {
      setupMocks({
        rateType: "PER_HOUR",
        rateValueGrosze: 6000,
        approvedMinutes: 60,
        invoicedAmountGrosze: 6000,
      });

      await computeTimeReconciliation(
        mockPrisma,
        ORG_ID,
        CONTRACT_ID,
        PERIOD_START,
        PERIOD_END,
        6000,
      );

      expect(mockPrisma.timeEntry.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timesheet: { status: "APPROVED" },
          }),
        }),
      );
    });

    it("calculates deviation percentage to 2 decimal places", async () => {
      // 60 minutes at 10000/hr = expected 10000. Invoiced 10333.
      // deviation = 333, percent = (333/10000)*100 = 3.33
      setupMocks({
        rateType: "PER_HOUR",
        rateValueGrosze: 10000,
        approvedMinutes: 60,
        invoicedAmountGrosze: 10333,
      });

      const result = await computeTimeReconciliation(
        mockPrisma,
        ORG_ID,
        CONTRACT_ID,
        PERIOD_START,
        PERIOD_END,
        10333,
      );

      expect(result).not.toBeNull();
      expect(result!.deviationPercent).toBe(3.33);
    });

    it("marks withinThreshold=true when deviation <= org threshold", async () => {
      // expected 10000, invoiced 10500 => 5% deviation, threshold 10%
      setupMocks({
        rateType: "PER_HOUR",
        rateValueGrosze: 10000,
        approvedMinutes: 60,
        invoicedAmountGrosze: 10500,
        thresholdPercent: 10,
      });

      const result = await computeTimeReconciliation(
        mockPrisma,
        ORG_ID,
        CONTRACT_ID,
        PERIOD_START,
        PERIOD_END,
        10500,
      );

      expect(result).not.toBeNull();
      expect(result!.withinThreshold).toBe(true);
    });

    it("marks withinThreshold=false when deviation > org threshold", async () => {
      // expected 10000, invoiced 12000 => 20% deviation, threshold 10%
      setupMocks({
        rateType: "PER_HOUR",
        rateValueGrosze: 10000,
        approvedMinutes: 60,
        invoicedAmountGrosze: 12000,
        thresholdPercent: 10,
      });

      const result = await computeTimeReconciliation(
        mockPrisma,
        ORG_ID,
        CONTRACT_ID,
        PERIOD_START,
        PERIOD_END,
        12000,
      );

      expect(result).not.toBeNull();
      expect(result!.withinThreshold).toBe(false);
      expect(result!.deviationPercent).toBe(20);
    });

    it("uses org settingsJson.timeDeviationThresholdPercent (default 10%)", async () => {
      // No threshold set in settings => default 10%
      // expected 10000, invoiced 10900 => 9% deviation => within default 10%
      setupMocks({
        rateType: "PER_HOUR",
        rateValueGrosze: 10000,
        approvedMinutes: 60,
        invoicedAmountGrosze: 10900,
      });

      const result = await computeTimeReconciliation(
        mockPrisma,
        ORG_ID,
        CONTRACT_ID,
        PERIOD_START,
        PERIOD_END,
        10900,
      );

      expect(result).not.toBeNull();
      expect(result!.thresholdPercent).toBe(10);
      expect(result!.withinThreshold).toBe(true);
    });

    it("uses org settingsJson.timeHoursPerDay for PER_DAY (default 8)", async () => {
      // No hoursPerDay set => default 8
      // 480 min = 1 day at default 8 hrs. Rate 50000/day => expected 50000
      setupMocks({
        rateType: "PER_DAY",
        rateValueGrosze: 50000,
        approvedMinutes: 480,
        invoicedAmountGrosze: 50000,
      });

      const result = await computeTimeReconciliation(
        mockPrisma,
        ORG_ID,
        CONTRACT_ID,
        PERIOD_START,
        PERIOD_END,
        50000,
      );

      expect(result).not.toBeNull();
      expect(result!.hoursPerDay).toBe(8);
      expect(result!.expectedAmountGrosze).toBe(50000);
    });
  });
});
