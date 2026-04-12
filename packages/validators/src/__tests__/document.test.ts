import { describe, expect, it } from "vitest";
import {
  documentConfirmUploadSchema,
  documentLinkSchema,
  documentListSchema,
  documentRequestUploadSchema,
  documentVersionUploadSchema,
} from "../document.js";

const MAX = 25 * 1024 * 1024;

describe("documentRequestUploadSchema", () => {
  it("accepts upload request under size cap", () => {
    const r = documentRequestUploadSchema.safeParse({
      filename: "scan.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 1024,
      documentType: "INVOICE",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.linkRole).toBe("PRIMARY");
  });

  it("rejects file larger than 25 MB", () => {
    const r = documentRequestUploadSchema.safeParse({
      filename: "big.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: MAX + 1,
      documentType: "OTHER",
    });
    expect(r.success).toBe(false);
  });
});

describe("documentConfirmUploadSchema", () => {
  it("requires documentId", () => {
    const r = documentConfirmUploadSchema.safeParse({
      documentId: "d1",
    });
    expect(r.success).toBe(true);
  });
});

describe("documentLinkSchema", () => {
  it("requires entity type and id", () => {
    const r = documentLinkSchema.safeParse({
      documentId: "d1",
      entityType: "CONTRACT",
      entityId: "c1",
    });
    expect(r.success).toBe(true);
  });
});

describe("documentListSchema", () => {
  it("defaults pagination", () => {
    const r = documentListSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.pageSize).toBe(25);
    }
  });
});

describe("documentVersionUploadSchema", () => {
  it("accepts version upload metadata", () => {
    const r = documentVersionUploadSchema.safeParse({
      existingDocumentId: "d1",
      filename: "v2.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 500,
    });
    expect(r.success).toBe(true);
  });
});
