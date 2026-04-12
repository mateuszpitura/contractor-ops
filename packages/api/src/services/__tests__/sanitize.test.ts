import { describe, expect, it } from "vitest";
import { sanitizeStrings, stripHtml } from "../sanitize.js";

// ---------------------------------------------------------------------------
// stripHtml
// ---------------------------------------------------------------------------

describe("stripHtml", () => {
  it("strips simple HTML tags", () => {
    expect(stripHtml("<b>bold</b>")).toBe("bold");
  });

  it("strips multiple tags", () => {
    expect(stripHtml("<p>Hello <em>world</em></p>")).toBe("Hello world");
  });

  it("strips script tags and their content", () => {
    expect(stripHtml("<script>alert('xss')</script>")).toBe("");
  });

  it("strips nested tags", () => {
    expect(stripHtml("<div><span><a href='x'>link</a></span></div>")).toBe("link");
  });

  it("strips self-closing tags", () => {
    expect(stripHtml("before<br/>after")).toBe("beforeafter");
    expect(stripHtml("before<img src='x' />after")).toBe("beforeafter");
  });

  it("strips tags with attributes", () => {
    expect(stripHtml('<a href="http://evil.com" onclick="steal()">click</a>')).toBe("click");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtml("Hello world")).toBe("Hello world");
  });

  it("trims surrounding whitespace", () => {
    expect(stripHtml("  hello  ")).toBe("hello");
  });

  it("returns empty string for tag-only input", () => {
    expect(stripHtml("<div></div>")).toBe("");
  });

  it("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });

  it("strips XSS payloads", () => {
    expect(stripHtml('<img src=x onerror="alert(1)">')).toBe("");
    expect(stripHtml('<svg onload="alert(1)">')).toBe("");
  });

  it("preserves angle brackets that are not HTML tags", () => {
    // Mathematical expression — the regex removes < followed by content >
    expect(stripHtml("5 > 3 and 2 < 4")).toBe("5 > 3 and 2 < 4");
  });
});

// ---------------------------------------------------------------------------
// sanitizeStrings
// ---------------------------------------------------------------------------

describe("sanitizeStrings", () => {
  it("sanitizes a plain string", () => {
    expect(sanitizeStrings("<b>hello</b>")).toBe("hello");
  });

  it("returns numbers unchanged", () => {
    expect(sanitizeStrings(42)).toBe(42);
  });

  it("returns booleans unchanged", () => {
    expect(sanitizeStrings(true)).toBe(true);
    expect(sanitizeStrings(false)).toBe(false);
  });

  it("returns null unchanged", () => {
    expect(sanitizeStrings(null)).toBeNull();
  });

  it("returns undefined unchanged", () => {
    expect(sanitizeStrings(undefined)).toBeUndefined();
  });

  it("returns Date instances unchanged (not recursed into)", () => {
    const date = new Date("2024-01-01");
    expect(sanitizeStrings(date)).toBe(date);
  });

  it("sanitizes string values in a flat object", () => {
    const input = { name: "<b>Alice</b>", age: 30 };
    expect(sanitizeStrings(input)).toEqual({ name: "Alice", age: 30 });
  });

  it("sanitizes nested objects recursively", () => {
    const input = {
      company: {
        name: "<script>evil</script>safe",
        address: {
          street: "<em>123 Main</em>",
          zip: 12345,
        },
      },
    };
    expect(sanitizeStrings(input)).toEqual({
      company: {
        name: "safe",
        address: {
          street: "123 Main",
          zip: 12345,
        },
      },
    });
  });

  it("sanitizes arrays of strings", () => {
    expect(sanitizeStrings(["<b>a</b>", "<i>b</i>"])).toEqual(["a", "b"]);
  });

  it("sanitizes arrays of objects", () => {
    const input = [
      { label: "<b>one</b>", value: 1 },
      { label: "<b>two</b>", value: 2 },
    ];
    expect(sanitizeStrings(input)).toEqual([
      { label: "one", value: 1 },
      { label: "two", value: 2 },
    ]);
  });

  it("handles mixed arrays (strings, numbers, objects)", () => {
    const input = ["<b>text</b>", 42, { key: "<i>val</i>" }];
    expect(sanitizeStrings(input)).toEqual(["text", 42, { key: "val" }]);
  });

  it("does not mutate the original object", () => {
    const input = { name: "<b>Alice</b>" };
    const result = sanitizeStrings(input);
    expect(result).toEqual({ name: "Alice" });
    expect(input.name).toBe("<b>Alice</b>");
  });

  it("handles deeply nested XSS payloads", () => {
    const input = {
      level1: {
        level2: {
          level3:
            "<script>document.cookie</script><img src=x onerror=\"fetch('//evil.com')\">safe text",
        },
      },
    };
    const result = sanitizeStrings(input);
    expect(result.level1.level2.level3).toBe("safe text");
  });

  it("handles empty objects and arrays", () => {
    expect(sanitizeStrings({})).toEqual({});
    expect(sanitizeStrings([])).toEqual([]);
  });
});
