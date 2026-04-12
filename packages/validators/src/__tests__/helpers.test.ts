import { describe, expect, it } from "vitest";
import { optionalFk, optionalPositiveInt, optionalString } from "../helpers.js";

describe("optionalString", () => {
  it("maps empty string to undefined", () => {
    const s = optionalString;
    expect(s.parse("")).toBeUndefined();
    expect(s.parse("hello")).toBe("hello");
  });
});

describe("optionalFk", () => {
  it("maps empty string to undefined", () => {
    const s = optionalFk;
    expect(s.parse("")).toBeUndefined();
    expect(s.parse("id-1")).toBe("id-1");
  });
});

describe("optionalPositiveInt", () => {
  it("maps empty and NaN to undefined", () => {
    const s = optionalPositiveInt;
    expect(s.parse("")).toBeUndefined();
    expect(s.parse(undefined)).toBeUndefined();
    expect(s.parse(5)).toBe(5);
  });

  it("rejects non-positive numbers", () => {
    const s = optionalPositiveInt;
    expect(() => s.parse(0)).toThrow();
  });
});
