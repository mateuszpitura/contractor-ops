-- Rollback for the sandbox-environment migration (migration.sql in this dir).
--
-- Drops the two added columns + the ApiKeyEnvironment enum. Fully reversible:
-- every object is new and no existing data is touched by the forward migration.
--
-- NOT APPLIED by codegen. Run only to reverse the additive step at the blocking
-- human migration gate.

-- AlterTable
ALTER TABLE "OrganizationApiKey" DROP COLUMN "environment";

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "isSandbox";

-- DropEnum
DROP TYPE "ApiKeyEnvironment";
