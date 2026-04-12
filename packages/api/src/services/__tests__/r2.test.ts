import { describe, expect, it } from "vitest";
import { generateStorageKey } from "../r2.js";

describe("r2 generateStorageKey", () => {
  it("builds org-scoped path with extension", () => {
    expect(generateStorageKey("org-1", "doc-2", "file.pdf")).toBe("orgs/org-1/documents/doc-2.pdf");
  });

  it("uses the substring after the last dot as the extension", () => {
    expect(generateStorageKey("o", "d", "archive.tar.gz")).toBe("orgs/o/documents/d.gz");
  });

  it("when filename has no dot, treats the whole name as the extension segment", () => {
    expect(generateStorageKey("o", "d", "readme")).toBe("orgs/o/documents/d.readme");
  });
});
