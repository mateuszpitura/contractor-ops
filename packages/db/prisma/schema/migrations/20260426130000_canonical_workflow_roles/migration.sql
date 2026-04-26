ALTER TABLE "WorkflowTaskTemplate"
  ALTER COLUMN "assigneeRole" TYPE TEXT
  USING CASE "assigneeRole"::text
    WHEN 'ORG_ADMIN' THEN 'admin'
    WHEN 'FINANCE_ADMIN' THEN 'finance_admin'
    WHEN 'OPS_MANAGER' THEN 'ops_manager'
    WHEN 'TEAM_MANAGER' THEN 'team_manager'
    WHEN 'LEGAL_VIEWER' THEN 'legal_compliance_viewer'
    WHEN 'IT_ADMIN' THEN 'it_admin'
    WHEN 'ACCOUNTANT' THEN 'external_accountant'
    WHEN 'READ_ONLY' THEN 'readonly'
    ELSE "assigneeRole"::text
  END;

ALTER TABLE "WorkflowTaskRun"
  ALTER COLUMN "assigneeRole" TYPE TEXT
  USING CASE "assigneeRole"::text
    WHEN 'ORG_ADMIN' THEN 'admin'
    WHEN 'FINANCE_ADMIN' THEN 'finance_admin'
    WHEN 'OPS_MANAGER' THEN 'ops_manager'
    WHEN 'TEAM_MANAGER' THEN 'team_manager'
    WHEN 'LEGAL_VIEWER' THEN 'legal_compliance_viewer'
    WHEN 'IT_ADMIN' THEN 'it_admin'
    WHEN 'ACCOUNTANT' THEN 'external_accountant'
    WHEN 'READ_ONLY' THEN 'readonly'
    ELSE "assigneeRole"::text
  END;

ALTER TABLE "ApprovalStep"
  ALTER COLUMN "approverRole" TYPE TEXT
  USING CASE "approverRole"::text
    WHEN 'ORG_ADMIN' THEN 'admin'
    WHEN 'FINANCE_ADMIN' THEN 'finance_admin'
    WHEN 'OPS_MANAGER' THEN 'ops_manager'
    WHEN 'TEAM_MANAGER' THEN 'team_manager'
    WHEN 'LEGAL_VIEWER' THEN 'legal_compliance_viewer'
    WHEN 'IT_ADMIN' THEN 'it_admin'
    WHEN 'ACCOUNTANT' THEN 'external_accountant'
    WHEN 'READ_ONLY' THEN 'readonly'
    ELSE "approverRole"::text
  END;

DROP TYPE "UserRole";

CREATE TYPE "UserRole" AS ENUM (
  'admin',
  'finance_admin',
  'ops_manager',
  'team_manager',
  'legal_compliance_viewer',
  'it_admin',
  'external_accountant',
  'readonly'
);

ALTER TABLE "WorkflowTaskTemplate"
  ALTER COLUMN "assigneeRole" TYPE "UserRole"
  USING "assigneeRole"::"UserRole";

ALTER TABLE "WorkflowTaskRun"
  ALTER COLUMN "assigneeRole" TYPE "UserRole"
  USING "assigneeRole"::"UserRole";

ALTER TABLE "ApprovalStep"
  ALTER COLUMN "approverRole" TYPE "UserRole"
  USING "approverRole"::"UserRole";
