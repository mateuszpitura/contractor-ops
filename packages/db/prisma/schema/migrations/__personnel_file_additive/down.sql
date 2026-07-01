-- Rollback for the additive PersonnelFile migration (migration.sql in this dir).
--
-- Mechanical reverse of migration.sql, applied in the opposite order: drop the
-- foreign keys, drop the two tables (their indexes go with them), then drop the
-- two added enum types. No existing table is touched — only the added objects are
-- removed, so a rollback restores the exact pre-migration state.
--
-- NOT APPLIED by codegen. Authored alongside migration.sql for reversibility; run
-- only to reverse the additive step at the blocking human migration gate.

-- DropForeignKey
ALTER TABLE "PersonnelFileDocument" DROP CONSTRAINT "PersonnelFileDocument_documentId_fkey";

-- DropForeignKey
ALTER TABLE "PersonnelFileDocument" DROP CONSTRAINT "PersonnelFileDocument_personnelFileId_fkey";

-- DropForeignKey
ALTER TABLE "PersonnelFileDocument" DROP CONSTRAINT "PersonnelFileDocument_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "PersonnelFile" DROP CONSTRAINT "PersonnelFile_workerId_fkey";

-- DropForeignKey
ALTER TABLE "PersonnelFile" DROP CONSTRAINT "PersonnelFile_organizationId_fkey";

-- DropTable
DROP TABLE "PersonnelFileDocument";

-- DropTable
DROP TABLE "PersonnelFile";

-- DropEnum
DROP TYPE "PersonnelDocClassificationMethod";

-- DropEnum
DROP TYPE "PersonnelFileSection";
