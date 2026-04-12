import { describe, expect, it } from "vitest";
import {
  createSingleEntrySchema,
  draftEntrySchema,
  listTimesheetsSchema,
  rejectTimesheetSchema,
  saveDraftEntriesSchema,
  syncExternalEntriesSchema,
  timeReconciliationSchema,
} from "../time-tracking.js";

describe("draftEntrySchema", () => {
  it("accepts YYYY-MM-DD date", () => {
    const r = draftEntrySchema.safeParse({
      contractId: "c1",
      entryDate: "2026-04-01",
      minutes: 480,
    });
    expect(r.success).toBe(true);
  });

  it("rejects minutes over 1440", () => {
    const r = draftEntrySchema.safeParse({
      contractId: "c1",
      entryDate: "2026-04-01",
      minutes: 2000,
    });
    expect(r.success).toBe(false);
  });
});

describe("saveDraftEntriesSchema", () => {
  it("requires at least one entry", () => {
    const bad = saveDraftEntriesSchema.safeParse({
      timesheetId: "t1",
      entries: [],
    });
    expect(bad.success).toBe(false);
  });
});

describe("createSingleEntrySchema", () => {
  it("requires minimum 15 minutes", () => {
    const bad = createSingleEntrySchema.safeParse({
      contractId: "c1",
      entryDate: "2026-04-01",
      minutes: 10,
    });
    expect(bad.success).toBe(false);

    const boundary = createSingleEntrySchema.safeParse({
      contractId: "c1",
      entryDate: "2026-04-01",
      minutes: 15,
    });
    expect(boundary.success).toBe(true);

    const good = createSingleEntrySchema.safeParse({
      contractId: "c1",
      entryDate: "2026-04-01",
      minutes: 30,
    });
    expect(good.success).toBe(true);
  });
});

describe("rejectTimesheetSchema", () => {
  it("requires reason length 10–500", () => {
    const bad = rejectTimesheetSchema.safeParse({
      timesheetId: "t1",
      reason: "short",
    });
    expect(bad.success).toBe(false);
    const good = rejectTimesheetSchema.safeParse({
      timesheetId: "t1",
      reason: "valid reason ok",
    });
    expect(good.success).toBe(true);
  });
});

describe("syncExternalEntriesSchema", () => {
  it("accepts CLOCKIFY or JIRA", () => {
    const r = syncExternalEntriesSchema.safeParse({
      provider: "CLOCKIFY",
      startDate: "2026-04-01",
      endDate: "2026-04-07",
    });
    expect(r.success).toBe(true);
  });
});

describe("timeReconciliationSchema", () => {
  it("accepts period and amount", () => {
    const r = timeReconciliationSchema.safeParse({
      contractId: "c1",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      invoicedAmountMinor: 100000,
    });
    expect(r.success).toBe(true);
  });
});

describe("listTimesheetsSchema", () => {
  it("defaults limit 20", () => {
    const r = listTimesheetsSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(20);
  });
});
