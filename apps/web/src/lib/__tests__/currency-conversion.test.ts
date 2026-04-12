import { describe, expect, it } from "vitest";
import { displayToMinor, minorToDisplay } from "../currency-conversion";

describe("minorToDisplay", () => {
  it("converts minor units to display string", () => {
    expect(minorToDisplay(10050)).toBe("100.50");
    expect(minorToDisplay(1)).toBe("0.01");
    expect(minorToDisplay(100)).toBe("1.00");
  });

  it('returns "" for null', () => {
    expect(minorToDisplay(null)).toBe("");
  });

  it('returns "" for undefined', () => {
    expect(minorToDisplay(undefined)).toBe("");
  });

  it('returns "" for zero', () => {
    expect(minorToDisplay(0)).toBe("");
  });

  it("handles negative values", () => {
    expect(minorToDisplay(-5000)).toBe("-50.00");
  });

  it("handles large values", () => {
    expect(minorToDisplay(999999999)).toBe("9999999.99");
  });
});

describe("displayToMinor", () => {
  it("converts PLN string to minor units", () => {
    expect(displayToMinor("100.50")).toBe(10050);
    expect(displayToMinor("0.01")).toBe(1);
    expect(displayToMinor("1")).toBe(100);
  });

  it("returns 0 for empty string", () => {
    expect(displayToMinor("")).toBe(0);
  });

  it("returns 0 for non-numeric input", () => {
    expect(displayToMinor("abc")).toBe(0);
    expect(displayToMinor("not a number")).toBe(0);
  });

  it("rounds to avoid floating point issues", () => {
    expect(displayToMinor("0.1")).toBe(10);
    expect(displayToMinor("0.29")).toBe(29);
    expect(displayToMinor("1.005")).toBe(100); // 1.005 * 100 = 100.5 -> rounds to 100 (banker's rounding)
  });

  it("handles negative values", () => {
    expect(displayToMinor("-50")).toBe(-5000);
  });
});
