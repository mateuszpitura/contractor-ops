-- CreateEnum
CREATE TYPE "ErrorClass" AS ENUM ('TRANSIENT_RATE_LIMIT', 'TRANSIENT_NETWORK', 'PERMANENT_NOT_FOUND', 'PERMANENT_AUTH_EXPIRED', 'PERMANENT_FORBIDDEN', 'PERMANENT_OTHER');

-- CreateEnum
CREATE TYPE "ManualOverrideCategory" AS ENUM ('verified_via_vendor_console', 'user_already_inactive', 'provider_endpoint_deprecated', 'transient_provider_issue_resolved', 'other');

-- AlterEnum
ALTER TYPE "DeprovisioningStepStatus" ADD VALUE 'MANUAL_COMPLETED';

-- AlterTable
ALTER TABLE "DeprovisioningStep" ADD COLUMN     "errorClass" "ErrorClass",
ADD COLUMN     "manualOverriddenAt" TIMESTAMP(3),
ADD COLUMN     "manualOverriddenByUserId" TEXT,
ADD COLUMN     "manualOverrideCategory" "ManualOverrideCategory",
ADD COLUMN     "manualOverrideNote" TEXT;

