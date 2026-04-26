-- Phase 62 (Plan 62-01) — Invoice intake staging + ZUGFeRD lifecycle columns.
-- Forward-only. The project applies schema evolution with `prisma db push` (not `migrate deploy`),
-- so this file is the canonical human-readable record of what the push produces. Naming follows
-- Prisma default conventions used throughout the schema: PascalCase table names, camelCase columns,
-- PascalCase enum types, explicit @@index map: names ≤63 chars matching the Prisma schema.
BEGIN;

-- 1. New enums for InvoiceIntakeRequest
CREATE TYPE "InvoiceIntakeSourceKind" AS ENUM ('UPLOAD_XML', 'UPLOAD_PDF');
CREATE TYPE "InvoiceIntakeStatus" AS ENUM ('PARSED', 'NEEDS_REVIEW', 'MATCHED', 'CONVERTED', 'REJECTED');
CREATE TYPE "InvoiceIntakeValidationStatus" AS ENUM ('VALID', 'WARNINGS', 'INVALID');
CREATE TYPE "InvoiceIntakeProfileLevel" AS ENUM ('COMFORT', 'XRECHNUNG', 'EXTENDED');

-- 2. New intake table (multi-tenant; matches EInvoiceLifecycle conventions)
CREATE TABLE "InvoiceIntakeRequest" (
  "id"                               TEXT PRIMARY KEY,
  "organizationId"                   TEXT NOT NULL,
  "uploadedByUserId"                 TEXT NOT NULL,
  "sourceKind"                       "InvoiceIntakeSourceKind" NOT NULL,
  "rawFileKey"                       TEXT NOT NULL,
  "rawFileSha256"                    VARCHAR(64) NOT NULL,
  "rawFileMime"                      VARCHAR(64) NOT NULL,
  "rawFileSizeBytes"                 INTEGER NOT NULL,
  "extractedXmlKey"                  TEXT,
  "validationReportKey"              TEXT,
  "profileLevel"                     "InvoiceIntakeProfileLevel" NOT NULL,
  "parsedInvoiceJson"                JSONB NOT NULL,
  "extractedSupplierName"            TEXT,
  "extractedSupplierVatId"           TEXT,
  "extractedSupplierLeitwegId"       TEXT,
  "extractedInvoiceNumber"           TEXT,
  "extractedInvoiceDate"             TIMESTAMP(3),
  "extractedTotalMinor"              BIGINT,
  "extractedCurrency"                CHAR(3),
  "matchedContractorId"              TEXT,
  "matchedContractId"                TEXT,
  "convertedInvoiceId"               TEXT,
  "status"                           "InvoiceIntakeStatus" NOT NULL DEFAULT 'PARSED',
  "validationStatus"                 "InvoiceIntakeValidationStatus" NOT NULL DEFAULT 'VALID',
  "validationAcknowledgedAt"         TIMESTAMP(3),
  "validationAcknowledgedByUserId"   TEXT,
  "rejectionReason"                  TEXT,
  "unmappedFieldsJson"               JSONB,
  "createdAt"                        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                        TIMESTAMP(3) NOT NULL
);

ALTER TABLE "InvoiceIntakeRequest"
  ADD CONSTRAINT "InvoiceIntakeRequest_organizationId_fkey"                   FOREIGN KEY ("organizationId")                 REFERENCES "Organization"("id"),
  ADD CONSTRAINT "InvoiceIntakeRequest_uploadedByUserId_fkey"                 FOREIGN KEY ("uploadedByUserId")               REFERENCES "User"("id"),
  ADD CONSTRAINT "InvoiceIntakeRequest_validationAcknowledgedByUserId_fkey"   FOREIGN KEY ("validationAcknowledgedByUserId") REFERENCES "User"("id"),
  ADD CONSTRAINT "InvoiceIntakeRequest_matchedContractorId_fkey"              FOREIGN KEY ("matchedContractorId")            REFERENCES "Contractor"("id"),
  ADD CONSTRAINT "InvoiceIntakeRequest_matchedContractId_fkey"                FOREIGN KEY ("matchedContractId")              REFERENCES "Contract"("id"),
  ADD CONSTRAINT "InvoiceIntakeRequest_convertedInvoiceId_fkey"               FOREIGN KEY ("convertedInvoiceId")             REFERENCES "Invoice"("id");

-- Indexes / unique constraints (names match Prisma schema @@index map: values, all ≤63 chars)
CREATE UNIQUE INDEX "invoice_intake_org_sha_uniq"       ON "InvoiceIntakeRequest"("organizationId", "rawFileSha256");
CREATE UNIQUE INDEX "InvoiceIntakeRequest_convertedInvoiceId_key" ON "InvoiceIntakeRequest"("convertedInvoiceId");
CREATE INDEX        "invoice_intake_org_status_idx"     ON "InvoiceIntakeRequest"("organizationId", "status");
CREATE INDEX        "invoice_intake_org_vat_idx"        ON "InvoiceIntakeRequest"("organizationId", "extractedSupplierVatId");
CREATE INDEX        "invoice_intake_org_created_idx"    ON "InvoiceIntakeRequest"("organizationId", "createdAt");

-- 3. Extend EInvoiceLifecycle with ZUGFeRD columns (Phase 62 D-17)
ALTER TABLE "EInvoiceLifecycle"
  ADD COLUMN "zugferdPdfKey"      TEXT,
  ADD COLUMN "zugferdPdfSha256"   VARCHAR(64),
  ADD COLUMN "zugferdGeneratedAt" TIMESTAMP(3);

COMMIT;

-- 4. Append ZUGFERD_GENERATED to the lifecycle event enum (must run outside the transaction
--    because PostgreSQL only allows ALTER TYPE ... ADD VALUE outside a transaction block).
ALTER TYPE "EInvoiceLifecycleEventType" ADD VALUE IF NOT EXISTS 'ZUGFERD_GENERATED';
