import { describe, expect, it } from "vitest";
import { formatFileSize, truncateFilename } from "../format-file-size";

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(1024 * 1024 - 1)).toBe("1024.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
    expect(formatFileSize(25 * 1024 * 1024)).toBe("25.0 MB");
  });
});

describe("truncateFilename", () => {
  it("returns short names unchanged", () => {
    expect(truncateFilename("file.pdf")).toBe("file.pdf");
    expect(truncateFilename("a".repeat(40))).toBe("a".repeat(40));
  });

  it("truncates long names preserving extension", () => {
    const name = "a".repeat(50) + ".pdf";
    const result = truncateFilename(name);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result).toContain("...");
    expect(result).toMatch(/\.pdf$/);
  });

  it("truncates long names without extension", () => {
    const name = "a".repeat(50);
    const result = truncateFilename(name);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result).toMatch(/\.\.\.$/);
  });

  it("respects custom maxLen", () => {
    const name = "my-long-document-name.pdf";
    const result = truncateFilename(name, 15);
    expect(result.length).toBeLessThanOrEqual(15);
    expect(result).toMatch(/\.pdf$/);
    expect(result).toContain("...");
  });

  it("handles files with multiple dots", () => {
    const name = "a".repeat(50) + ".test.pdf";
    const result = truncateFilename(name);
    expect(result).toMatch(/\.pdf$/);
  });
});
