import { describe, expect, it } from "vitest";
import {
  calendarEventMetadataSchema,
  calendarTaskConfigSchema,
  createCalendarEventInputSchema,
  deadlineTypeSchema,
} from "../calendar.js";

describe("calendarTaskConfigSchema", () => {
  it("defaults duration 1h and empty attendees", () => {
    const r = calendarTaskConfigSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.calendarEnabled).toBe(false);
      expect(r.data.duration).toBe("1h");
      expect(r.data.attendees).toEqual([]);
    }
  });

  it("validates attendee emails", () => {
    const bad = calendarTaskConfigSchema.safeParse({
      attendees: ["not-an-email"],
    });
    expect(bad.success).toBe(false);
  });
});

describe("calendarEventMetadataSchema", () => {
  it("requires provider enum", () => {
    const r = calendarEventMetadataSchema.safeParse({
      eventId: "e1",
      title: "Call",
      startTime: "2026-04-01T10:00:00Z",
      endTime: "2026-04-01T11:00:00Z",
      provider: "google_calendar",
    });
    expect(r.success).toBe(true);
  });
});

describe("deadlineTypeSchema", () => {
  it("accepts known types", () => {
    expect(deadlineTypeSchema.safeParse("PAYMENT_DUE").success).toBe(true);
  });
});

describe("createCalendarEventInputSchema", () => {
  it("accepts summary and times", () => {
    const r = createCalendarEventInputSchema.safeParse({
      summary: "Review",
      startDateTime: "2026-04-01T10:00:00Z",
      endDateTime: "2026-04-01T11:00:00Z",
    });
    expect(r.success).toBe(true);
  });
});
