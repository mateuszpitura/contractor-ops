-- PersonnelFile + PersonnelFileDocument personnel-file substrate + the section
-- and classification-method enums (additive, reversible).
--
-- Additive only: it creates two new enum types and two new tables (the 1:1
-- PersonnelFile sidecar on Worker, and the PersonnelFileDocument join into the
-- existing Document stack), with their unique/lookup indexes and foreign keys to
-- Organization, Worker, PersonnelFile, and Document. It does NOT alter any
-- existing table and performs NO backfill — every existing row is untouched, so
-- applying it cannot fail on existing data.
--
-- ORDERING: requires the Worker table (from 20260705160000_worker_base_additive)
-- and the Document table (from the baseline) to already exist in the target
-- region, because PersonnelFile references Worker and PersonnelFileDocument
-- references Document. The timestamp ordering guarantees both replay first.
--
-- Reversibility: every statement here is undone by the paired down.sql in this
-- directory. No existing row is touched destructively; a rollback drops only the
-- added enums, tables, indexes and constraints.
--
-- NOT APPLIED by codegen. Authored as a file; applied per region (EU, then ME,
-- then US) at the blocking human migration gate.

-- CreateEnum
CREATE TYPE "PersonnelFileSection" AS ENUM ('SECTION_A', 'SECTION_B', 'SECTION_C', 'SECTION_D');

-- CreateEnum
CREATE TYPE "PersonnelDocClassificationMethod" AS ENUM ('DETERMINISTIC', 'AI', 'MANUAL', 'PENDING');

-- CreateTable
CREATE TABLE "PersonnelFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "hireDate" DATE,
    "terminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PersonnelFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelFileDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personnelFileId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "section" "PersonnelFileSection",
    "documentDate" DATE,
    "classificationMethod" "PersonnelDocClassificationMethod" NOT NULL DEFAULT 'PENDING',
    "aiSectionGuess" "PersonnelFileSection",
    "aiConfidence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PersonnelFileDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonnelFile_workerId_key" ON "PersonnelFile"("workerId");

-- CreateIndex
CREATE INDEX "PersonnelFile_organizationId_idx" ON "PersonnelFile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonnelFile_organizationId_workerId_key" ON "PersonnelFile"("organizationId", "workerId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonnelFileDocument_documentId_key" ON "PersonnelFileDocument"("documentId");

-- CreateIndex
CREATE INDEX "PersonnelFileDocument_organizationId_idx" ON "PersonnelFileDocument"("organizationId");

-- CreateIndex
CREATE INDEX "PersonnelFileDocument_personnelFileId_idx" ON "PersonnelFileDocument"("personnelFileId");

-- AddForeignKey
ALTER TABLE "PersonnelFile" ADD CONSTRAINT "PersonnelFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelFile" ADD CONSTRAINT "PersonnelFile_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelFileDocument" ADD CONSTRAINT "PersonnelFileDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelFileDocument" ADD CONSTRAINT "PersonnelFileDocument_personnelFileId_fkey" FOREIGN KEY ("personnelFileId") REFERENCES "PersonnelFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelFileDocument" ADD CONSTRAINT "PersonnelFileDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
