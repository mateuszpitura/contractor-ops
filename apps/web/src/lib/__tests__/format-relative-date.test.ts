import { afterEach, describe, expect, it, vi } from "vitest";
import { formatRelativeDate } from "../format-relative-date";

describe("formatRelativeDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "today" for a date within the same day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T14:00:00Z"));
    expect(formatRelativeDate("2024-06-15T10:00:00Z")).toBe("today");
  });

  it('returns "yesterday" for a date exactly 1 day ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T14:00:00Z"));
    expect(formatRelativeDate("2024-06-14T10:00:00Z")).toBe("yesterday");
  });

  it('returns "Xd ago" for dates 2-29 days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T14:00:00Z"));
    expect(formatRelativeDate("2024-06-13T10:00:00Z")).toBe("2d ago");
    expect(formatRelativeDate("2024-06-01T10:00:00Z")).toBe("14d ago");
    expect(formatRelativeDate("2024-05-17T14:00:00Z")).toBe("29d ago");
  });

  it("returns pl-PL locale date for 30+ days ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T14:00:00Z"));
    const result = formatRelativeDate("2024-05-01T10:00:00Z");
    // pl-PL format: DD.MM.YYYY or similar
    expect(result).toMatch(/\d/);
    expect(result).not.toContain("ago");
  });

  it("accepts a Date object", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T14:00:00Z"));
    expect(formatRelativeDate(new Date("2024-06-15T10:00:00Z"))).toBe("today");
  });

  it("handles boundary at exactly 30 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-30T12:00:00Z"));
    const result = formatRelativeDate("2024-05-31T12:00:00Z");
    // 30 days = falls through to locale date
    expect(result).not.toBe("30d ago");
  });
});
