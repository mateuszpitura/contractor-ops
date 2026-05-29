BEGIN;

-- ClassificationAssessmentStatus
ALTER TABLE "ClassificationAssessment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ClassificationAssessment" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
DROP TYPE "ClassificationAssessmentStatus";
CREATE TYPE "ClassificationAssessmentStatus" AS ENUM ('DRAFT', 'COMPLETED');
ALTER TABLE "ClassificationAssessment"
    ALTER COLUMN "status" TYPE "ClassificationAssessmentStatus"
    USING UPPER("status")::"ClassificationAssessmentStatus";
ALTER TABLE "ClassificationAssessment" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- EconomicDependencyBand
ALTER TABLE "EconomicDependencyAlertState" ALTER COLUMN "currentBand" DROP DEFAULT;
ALTER TABLE "EconomicDependencyAlertState" ALTER COLUMN "currentBand" TYPE TEXT USING "currentBand"::TEXT;
DROP TYPE "EconomicDependencyBand";
CREATE TYPE "EconomicDependencyBand" AS ENUM ('SAFE', 'WARNING', 'CRITICAL');
ALTER TABLE "EconomicDependencyAlertState"
    ALTER COLUMN "currentBand" TYPE "EconomicDependencyBand"
    USING UPPER("currentBand")::"EconomicDependencyBand";
ALTER TABLE "EconomicDependencyAlertState" ALTER COLUMN "currentBand" SET DEFAULT 'SAFE';

-- WaivedReason
ALTER TABLE "ContractorComplianceItem" ALTER COLUMN "waivedReason" TYPE TEXT USING "waivedReason"::TEXT;
DROP TYPE "WaivedReason";
CREATE TYPE "WaivedReason" AS ENUM (
    'SUPERSEDED_BY_POLICY_VERSION',
    'CLASSIFICATION_OUTCOME_CHANGE',
    'ADMIN_MANUAL_WAIVE',
    'CONTRACTOR_OFFBOARDED'
);
ALTER TABLE "ContractorComplianceItem"
    ALTER COLUMN "waivedReason" TYPE "WaivedReason"
    USING UPPER("waivedReason")::"WaivedReason";

-- ValidationStatus
ALTER TABLE "Contractor"      ALTER COLUMN "latestVatValidationStatus" TYPE TEXT USING "latestVatValidationStatus"::TEXT;
ALTER TABLE "TaxIdValidation" ALTER COLUMN "responseStatus"            TYPE TEXT USING "responseStatus"::TEXT;
DROP TYPE "ValidationStatus";
CREATE TYPE "ValidationStatus" AS ENUM ('VALID', 'INVALID', 'STALE', 'UNAVAILABLE');
ALTER TABLE "Contractor"
    ALTER COLUMN "latestVatValidationStatus" TYPE "ValidationStatus"
    USING UPPER("latestVatValidationStatus")::"ValidationStatus";
ALTER TABLE "TaxIdValidation"
    ALTER COLUMN "responseStatus" TYPE "ValidationStatus"
    USING UPPER("responseStatus")::"ValidationStatus";

-- UserRole
ALTER TABLE "ApprovalStep"         ALTER COLUMN "approverRole" TYPE TEXT USING "approverRole"::TEXT;
ALTER TABLE "WorkflowTaskTemplate" ALTER COLUMN "assigneeRole" TYPE TEXT USING "assigneeRole"::TEXT;
ALTER TABLE "WorkflowTaskRun"      ALTER COLUMN "assigneeRole" TYPE TEXT USING "assigneeRole"::TEXT;

DROP TYPE "UserRole";
CREATE TYPE "UserRole" AS ENUM (
    'ADMIN',
    'FINANCE_ADMIN',
    'OPS_MANAGER',
    'TEAM_MANAGER',
    'LEGAL_COMPLIANCE_VIEWER',
    'IT_ADMIN',
    'EXTERNAL_ACCOUNTANT',
    'READONLY'
);

ALTER TABLE "ApprovalStep"
    ALTER COLUMN "approverRole" TYPE "UserRole"
    USING UPPER("approverRole")::"UserRole";
ALTER TABLE "WorkflowTaskTemplate"
    ALTER COLUMN "assigneeRole" TYPE "UserRole"
    USING UPPER("assigneeRole")::"UserRole";
ALTER TABLE "WorkflowTaskRun"
    ALTER COLUMN "assigneeRole" TYPE "UserRole"
    USING UPPER("assigneeRole")::"UserRole";

COMMIT;
