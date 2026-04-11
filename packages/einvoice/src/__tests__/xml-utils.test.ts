import { describe, it, expect } from "vitest";
import { dig, toMinorUnits } from "../engine/xml-utils.js";

describe("dig", () => {
  it("returns nested value for valid path", () => {
    const obj = { a: { b: { c: 42 } } };
    expect(dig(obj, "a", "b", "c")).toBe(42);
  });

  it("returns undefined for missing path segment", () => {
    const obj = { a: { b: 1 } };
    expect(dig(obj, "a", "x", "y")).toBeUndefined();
  });

  it("returns undefined for null intermediate", () => {
    const obj = { a: null } as unknown as Record<string, unknown>;
    expect(dig(obj, "a", "b")).toBeUndefined();
  });

  it("returns top-level value", () => {
    const obj = { key: "value" };
    expect(dig(obj, "key")).toBe("value");
  });

  it("returns undefined for empty object", () => {
    expect(dig({}, "a")).toBeUndefined();
  });
});

describe("toMinorUnits", () => {
  it("converts float to minor units (default exponent 2)", () => {
    expect(toMinorUnits(123.45)).toBe(12345);
  });

  it("converts string to minor units", () => {
    expect(toMinorUnits("99.99")).toBe(9999);
  });

  it("returns 0 for undefined", () => {
    expect(toMinorUnits(undefined)).toBe(0);
  });

  it("returns 0 for null", () => {
    expect(toMinorUnits(null)).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(toMinorUnits("")).toBe(0);
  });

  it("handles custom exponent (3 for KWD)", () => {
    expect(toMinorUnits(1.234, 3)).toBe(1234);
  });

  it("rounds correctly for floating point", () => {
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
  });
});
