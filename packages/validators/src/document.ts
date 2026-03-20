import { z } from "zod";

// ---------------------------------------------------------------------------
// Prisma enum mirrors (string unions — validators package has no Prisma dep)
// ---------------------------------------------------------------------------

const documentTypeEnum = z.enum([
  "MASTER_CONTRACT",
  "AMENDMENT",
  "NDA",
  "IP_ASSIGNMENT",
  "DPA",
  "TAX_CERTIFICATE",
  "BUSINESS_REGISTRATION",
  "INVOICE",
  "TIMESHEET",
  "DELIVERABLE_ACCEPTANCE",
  "PAYMENT_EXPORT",
  "INSURANCE",
  "OTHER",
]);

const documentStatusEnum = z.enum([
  "ACTIVE",
  "SUPERSEDED",
  "EXPIRED",
  "ARCHIVED",
]);

const documentLinkEntityTypeEnum = z.enum(["CONTRACTOR", "CONTRACT"]);

const documentLinkRoleEnum = z.enum([
  "PRIMARY",
  "SUPPORTING",
  "GENERATED_OUTPUT",
  "SIGNED_COPY",
]);

/** Maximum allowed file size: 25 MB */
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Document schemas
// ---------------------------------------------------------------------------

/**
 * Schema for requesting a presigned upload URL.
 * Creates a Document record and returns upload URL + storage key.
 */
export const documentRequestUploadSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  mimeType: z.string().min(1, "MIME type is required"),
  fileSizeBytes: z
    .number()
    .int()
    .positive("File size must be positive")
    .max(MAX_FILE_SIZE_BYTES, "File exceeds 25 MB limit"),
  documentType: documentTypeEnum,
  entityType: documentLinkEntityTypeEnum.optional(),
  entityId: z.string().optional(),
  linkRole: documentLinkRoleEnum.default("PRIMARY"),
});

export type DocumentRequestUploadInput = z.infer<
  typeof documentRequestUploadSchema
>;

/**
 * Schema for confirming that a file was uploaded to R2.
 * Triggers virus scan and MIME validation.
 */
export const documentConfirmUploadSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
});

export type DocumentConfirmUploadInput = z.infer<
  typeof documentConfirmUploadSchema
>;

/**
 * Schema for linking a document to a contractor or contract entity.
 */
export const documentLinkSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  entityType: documentLinkEntityTypeEnum,
  entityId: z.string().min(1, "Entity ID is required"),
  linkRole: documentLinkRoleEnum.default("PRIMARY"),
});

export type DocumentLinkInput = z.infer<typeof documentLinkSchema>;

/**
 * Schema for listing documents with pagination and filtering.
 */
export const documentListSchema = z.object({
  entityType: documentLinkEntityTypeEnum.optional(),
  entityId: z.string().optional(),
  documentType: z.array(documentTypeEnum).optional(),
  status: z.array(documentStatusEnum).optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(50).default(25),
});

export type DocumentListInput = z.infer<typeof documentListSchema>;

/**
 * Schema for uploading a new version of an existing document.
 * Marks the existing document as SUPERSEDED and creates a new one.
 */
export const documentVersionUploadSchema = z.object({
  existingDocumentId: z.string().min(1, "Existing document ID is required"),
  filename: z.string().min(1, "Filename is required"),
  mimeType: z.string().min(1, "MIME type is required"),
  fileSizeBytes: z
    .number()
    .int()
    .positive("File size must be positive")
    .max(MAX_FILE_SIZE_BYTES, "File exceeds 25 MB limit"),
});

export type DocumentVersionUploadInput = z.infer<
  typeof documentVersionUploadSchema
>;
