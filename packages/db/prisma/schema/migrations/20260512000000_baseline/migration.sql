-- ==========================================================================
-- Squashed baseline migration (2026-05-12)
--
-- This migration replaces 17 individual migrations that were previously
-- applied via `prisma db push` (schema) + hand-written SQL files (custom).
-- The schema was never bootstrapped with a Prisma migration, so the
-- shadow database could not replay the history. This baseline captures
-- the full schema + all custom SQL in a single migration.
--
-- Squashed migrations and what they contributed:
--
--   20260318120000_enable_rls
--     → RLS helper functions (app.current_org_id, app.current_user_id,
--       app.is_org_member, app.has_role, app.can_write_ops,
--       app.can_write_finance, app.can_write_workflow, app.org_match)
--     → RLS policies for: Team, Project, CostCenter, Contractor,
--       ContractorContact, ContractorBillingProfile, ContractorAssignment,
--       ContractorTag, ContractorTagLink, ComplianceRequirementTemplate,
--       ContractorComplianceItem, Contract, ContractAmendment,
--       ContractRatePeriod, Document, DocumentLink, Invoice, InvoiceFile,
--       InvoiceLine, InvoiceMatchResult, PaymentRun, PaymentRunItem,
--       PaymentExport, WorkflowTemplate, WorkflowTaskTemplate,
--       WorkflowRun, WorkflowTaskRun, WorkflowComment,
--       WorkflowAttachment, ApprovalChainConfig, ApprovalFlow,
--       ApprovalStep, ApprovalDecision, IntegrationConnection,
--       ExternalLink, IntegrationSyncLog, WebhookDelivery, Notification,
--       UserNotificationPreference, Comment, ReminderRule,
--       ReminderInstance, AuditLog, OutboxEvent
--
--   20260320120000_add_contractor_search_vector
--     → Generated tsvector column "search_vector" on Contractor
--       (legalName A, displayName A, taxId B, email B) + GIN index
--
--   20260320140000_add_contract_search_vector
--     → Generated tsvector column "searchVector" on Contract
--       (title A, contractNumber B, notes C) + GIN index
--
--   20260322000000_add_invoice_search_vector
--     → Generated tsvector column "search_vector" on Invoice
--       (invoiceNumber A, notes B) + GIN index
--
--   20260411120000_extend_rls_coverage
--     → RLS policies for: Equipment, EquipmentAssignment, Shipment,
--       ShipmentEvent, ReturnRequest, CourierConfig, SigningEnvelope,
--       SigningEvent, SigningRecipient, Timesheet, TimeEntry,
--       OcrExtraction, OcrCreditLedger, Subscription, PortalSession,
--       ContractorChangeRequest, ContractorNotificationPreference
--
--   20260411130000_workflow_condition_operators_snake_case
--     → Data migration: WorkflowTaskTemplate configJson operators
--       notEquals→not_equals, startsWith→starts_with
--       (no-op on fresh database)
--
--   20260411140000_approval_condition_field_snake_case
--     → Data migration: ApprovalChainConfig conditionsJson field
--       contractorType→contractor_type
--       (no-op on fresh database)
--
--   20260414120000_invoice_intake_request
--     → CREATE TABLE InvoiceIntakeRequest + enums
--       (now in Prisma-generated schema section)
--     → ALTER TABLE EInvoiceLifecycle: zugferdPdfKey, zugferdPdfSha256,
--       zugferdGeneratedAt columns (now in schema section)
--     → ALTER TYPE EInvoiceLifecycleEventType ADD VALUE ZUGFERD_GENERATED
--       (now in schema section)
--
--   20260422120000_payment_run_invoice_uniques
--     → UNIQUE INDEX PaymentRun_organizationId_runNumber_key
--     → UNIQUE INDEX Invoice_organizationId_contractorId_invoiceNumber_key
--
--   20260422140000_late_interest_claim_async_pdf
--     → CREATE TYPE InvoiceInterestClaimPdfStatus + columns pdfStatus,
--       pdfError, pdfReadyAt on invoice_interest_claim
--       (now in schema section)
--     → INDEX invoice_interest_claim_pdfStatus_createdAt_idx
--       (now in schema section)
--
--   20260423010000_webhook_delivery_processing_state
--     → ALTER TYPE WebhookDeliveryStatus ADD VALUE PROCESSING
--       (now in schema section)
--
--   20260426090000_payment_run_active_invoice_guard
--     → Partial UNIQUE INDEX PaymentRunItem_active_invoice_once_idx
--       WHERE status IN ('PENDING','EXPORTED')
--
--   20260426120000_reminder_unique_notification_cron_dedup
--     → UNIQUE INDEX ReminderInstance dedup (reminderRuleId, entityType,
--       entityId, scheduledFor)
--     → CREATE TABLE NotificationCronDedup (now also in schema section)
--
--   20260426130000_canonical_workflow_roles
--     → Data migration: UserRole enum values ORG_ADMIN→admin, etc.
--       (baseline schema already has canonical enum values; no-op)
--
--   20260426215605_add_scope_capabilities
--     → ALTER TABLE IntegrationConnection ADD COLUMN scopeCapabilities
--       (now in schema section)
--
--   20260427103913_add_compliance_policy_columns_v6
--     → CREATE TYPE Severity, WaivedReason + columns severity,
--       policyRuleId, expiryJurisdictionTz, waivedReason on
--       ContractorComplianceItem + policyRuleSetVersion on
--       ClassificationAssessment (now in schema section)
--
--   20260427105536_phase_74_offboarding_foundation
--     → CREATE TABLE WorkflowRoleTemplate, WorkflowRoleTaskTemplate
--       + columns workflowRoleId, fallbackApproverId, outOfOffice,
--       overriddenTemplateId, etc. (now in schema section)
--     → ALTER TYPE WorkflowTaskType ADD VALUE IP_VERIFICATION,
--       CONTRACT_HEALTH_CHECK (now in schema section)
--
-- ==========================================================================

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalResourceType" AS ENUM ('INVOICE', 'DOCUMENT', 'CONTRACT');

-- CreateEnum
CREATE TYPE "ApprovalDecisionType" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_CHANGES', 'DELEGATE');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM', 'INTEGRATION', 'API_KEY', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAUSED');

-- CreateEnum
CREATE TYPE "ClassificationAssessmentStatus" AS ENUM ('draft', 'completed');

-- CreateEnum
CREATE TYPE "ClassificationDocumentKind" AS ENUM ('SDS', 'DRV_DEFENSE_BUNDLE', 'DRV_DECISION_LETTER');

-- CreateEnum
CREATE TYPE "Ir35ChainRole" AS ENUM ('CLIENT', 'AGENCY', 'PSC', 'WORKER');

-- CreateEnum
CREATE TYPE "EconomicDependencyBand" AS ENUM ('safe', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "ReassessmentTriggerStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "StatusfeststellungsverfahrenOutcome" AS ENUM ('PENDING', 'SELBSTANDIG', 'ABHANGIG', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EscalationVerdict" AS ENUM ('IR35_OUTSIDE', 'IR35_INSIDE', 'IR35_INDETERMINATE', 'SCHEIN_SELFEMPLOYED', 'SCHEIN_EMPLOYED', 'SCHEIN_UNCLEAR');

-- CreateEnum
CREATE TYPE "EscalationTriggerKind" AS ENUM ('AMBER_VERDICT_AUTO', 'GET_EXPERT_HELP_CLICK', 'MANUAL_FLAG');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('CONTRACTOR_DATA_PROCESSING', 'INVOICE_PAYMENT_PROCESSING', 'ANALYTICS_REPORTING', 'CROSS_BORDER_TRANSFER', 'INTEGRATION_DATA_SHARING', 'COMMUNICATION_NOTIFICATIONS');

-- CreateEnum
CREATE TYPE "ConsentEventScope" AS ENUM ('TOS');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('B2B_MASTER_SERVICE', 'STATEMENT_OF_WORK', 'NDA', 'IP_ASSIGNMENT', 'DPA', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'SIGNATURE_DECLINED', 'SIGNATURE_EXPIRED', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BillingModel" AS ENUM ('MONTHLY_RETAINER', 'HOURLY', 'DAILY', 'MILESTONE', 'DELIVERABLE_BASED', 'MIXED');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('MONTHLY_FIXED', 'PER_HOUR', 'PER_DAY', 'PER_MILESTONE', 'PER_DELIVERABLE');

-- CreateEnum
CREATE TYPE "InvoiceCycle" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ON_DELIVERABLE', 'AD_HOC');

-- CreateEnum
CREATE TYPE "ComplianceRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('MASTER_CONTRACT', 'AMENDMENT', 'NDA', 'IP_ASSIGNMENT', 'DPA', 'TAX_CERTIFICATE', 'BUSINESS_REGISTRATION', 'INVOICE', 'TIMESHEET', 'DELIVERABLE_ACCEPTANCE', 'PAYMENT_EXPORT', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('PRIVATE', 'INTERNAL', 'SHARED_WITH_ACCOUNTANT');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('USER_UPLOAD', 'EMAIL_INTAKE', 'ESIGN', 'KSEF', 'API', 'GENERATED');

-- CreateEnum
CREATE TYPE "VirusScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('ORGANIZATION', 'CONTRACTOR', 'CONTRACT', 'DOCUMENT', 'INVOICE', 'WORKFLOW_RUN', 'WORKFLOW_TASK_RUN', 'PAYMENT_RUN', 'PROJECT', 'TEAM', 'APPROVAL_FLOW', 'TIMESHEET', 'EQUIPMENT', 'SHIPMENT', 'USER', 'RETURN_REQUEST');

-- CreateEnum
CREATE TYPE "DocumentLinkRole" AS ENUM ('PRIMARY', 'SUPPORTING', 'GENERATED_OUTPUT', 'SIGNED_COPY');

-- CreateEnum
CREATE TYPE "ContractorType" AS ENUM ('SOLE_TRADER', 'COMPANY', 'INDIVIDUAL_FREELANCER', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContractorLifecycleStage" AS ENUM ('DRAFT', 'ONBOARDING', 'ACTIVE', 'OFFBOARDING', 'ENDED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'ENDED', 'PLANNED');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('MISSING', 'PENDING', 'SATISFIED', 'EXPIRED', 'WAIVED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('BLOCKING', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "WaivedReason" AS ENUM ('superseded_by_policy_version', 'classification_outcome_change', 'admin_manual_waive', 'contractor_offboarded');

-- CreateEnum
CREATE TYPE "EInvoiceValidationStatus" AS ENUM ('NOT_VALIDATED', 'VALID', 'INVALID', 'WARNINGS');

-- CreateEnum
CREATE TYPE "EInvoiceTransmissionStatus" AS ENUM ('NOT_SENT', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "EInvoiceLifecycleEventType" AS ENUM ('GENERATED', 'VALIDATED', 'TRANSMITTED', 'DELIVERY_ACK', 'DELIVERY_FAILED', 'RE_VALIDATED', 'RE_TRANSMITTED', 'ZUGFERD_GENERATED');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('LAPTOP', 'MONITOR', 'PHONE', 'HEADSET', 'KEYBOARD', 'MOUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'RETURNED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'LABEL_GENERATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ShipmentDirection" AS ENUM ('OUTBOUND', 'RETURN');

-- CreateEnum
CREATE TYPE "ReturnRequestStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SHIPMENT_CREATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SigningEnvelopeStatus" AS ENUM ('CREATED', 'SENT', 'DELIVERED', 'COMPLETED', 'DECLINED', 'VOIDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SigningRecipientRole" AS ENUM ('SIGNER', 'COUNTERSIGNER');

-- CreateEnum
CREATE TYPE "SigningRecipientStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'VIEWED', 'SIGNED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SigningEventType" AS ENUM ('ENVELOPE_CREATED', 'ENVELOPE_SENT', 'RECIPIENT_VIEWED', 'RECIPIENT_SIGNED', 'RECIPIENT_DECLINED', 'ENVELOPE_COMPLETED', 'ENVELOPE_VOIDED', 'ENVELOPE_EXPIRED', 'SIGNED_PDF_SAVED');

-- CreateEnum
CREATE TYPE "AsyncExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "BoERateSource" AS ENUM ('BOE_API', 'MANUAL');

-- CreateEnum
CREATE TYPE "SkontoEligibility" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('SLACK', 'RESEND', 'GOOGLE_WORKSPACE', 'MICROSOFT_365', 'JIRA', 'DOCUSIGN', 'AUTENTI', 'KSEF', 'ACCOUNTING', 'OPEN_BANKING', 'GITHUB', 'GITLAB', 'CLOCKIFY', 'NOTION', 'CONFLUENCE', 'GOOGLE_CALENDAR', 'OUTLOOK_CALENDAR', 'LINEAR', 'MICROSOFT_TEAMS', 'PEPPOL', 'ZATCA');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'REAUTH_REQUIRED', 'PENDING_MAPPING');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('STARTED', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "InvoiceSource" AS ENUM ('MANUAL_UPLOAD', 'EMAIL_INTAKE', 'KSEF', 'API', 'PORTAL', 'PEPPOL', 'LATE_INTEREST_CLAIM');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'APPROVAL_PENDING', 'APPROVED', 'REJECTED', 'READY_FOR_PAYMENT', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "InvoiceMatchStatus" AS ENUM ('UNMATCHED', 'PARTIAL', 'MATCHED', 'DISCREPANCY', 'MANUALLY_CONFIRMED');

-- CreateEnum
CREATE TYPE "InvoiceFileRole" AS ENUM ('SOURCE_ORIGINAL', 'PARSED_COPY', 'SUPPORTING_ATTACHMENT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "MatchBy" AS ENUM ('RULE_ENGINE', 'MANUAL', 'INTEGRATION', 'OCR_EXTRACTION');

-- CreateEnum
CREATE TYPE "InvoiceIntakeSourceKind" AS ENUM ('UPLOAD_XML', 'UPLOAD_PDF');

-- CreateEnum
CREATE TYPE "InvoiceIntakeStatus" AS ENUM ('PARSED', 'NEEDS_REVIEW', 'MATCHED', 'CONVERTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InvoiceIntakeValidationStatus" AS ENUM ('VALID', 'WARNINGS', 'INVALID');

-- CreateEnum
CREATE TYPE "InvoiceIntakeProfileLevel" AS ENUM ('COMFORT', 'XRECHNUNG', 'EXTENDED');

-- CreateEnum
CREATE TYPE "InvoicePaymentSourceKind" AS ENUM ('MANUAL', 'PAYMENT_RUN', 'BANK_STATEMENT');

-- CreateEnum
CREATE TYPE "InterestWaiveType" AS ENUM ('STATUTORY_INTEREST', 'COMPENSATION', 'BOTH');

-- CreateEnum
CREATE TYPE "InvoiceInterestClaimPdfStatus" AS ENUM ('PENDING_RENDER', 'RENDERING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SLACK', 'TEAMS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "ReminderTriggerType" AS ENUM ('BEFORE_DUE_DATE', 'ON_DUE_DATE', 'AFTER_DUE_DATE', 'BEFORE_CONTRACT_END', 'BEFORE_DOCUMENT_EXPIRY', 'ON_LIFECYCLE_CHANGE');

-- CreateEnum
CREATE TYPE "RecipientMode" AS ENUM ('ENTITY_OWNER', 'FINANCE_TEAM', 'ASSIGNEE', 'SPECIFIC_USER', 'ROLE');

-- CreateEnum
CREATE TYPE "ReminderInstanceStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OcrProvider" AS ENUM ('CLAUDE', 'GOOGLE_DOCUMENT_AI', 'AZURE_FORM_RECOGNIZER');

-- CreateEnum
CREATE TYPE "OcrExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'EXTRACTED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SimpleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DataRegion" AS ENUM ('EU', 'ME');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_READY', 'READY', 'IN_RUN', 'PARTIALLY_PAID', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentRunStatus" AS ENUM ('DRAFT', 'LOCKED', 'EXPORTED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentRunItemStatus" AS ENUM ('PENDING', 'EXPORTED', 'PAID', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PaymentExportFormat" AS ENUM ('CSV', 'BANK_FILE', 'SEPA_XML', 'SWIFT_XML', 'MT940', 'XML', 'API_PUSH', 'BACS_STD18');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('GENERATED', 'DOWNLOADED', 'FAILED');

-- CreateEnum
CREATE TYPE "PeppolParticipantStatus" AS ENUM ('PENDING', 'REGISTERED', 'ACTIVE', 'SUSPENDED', 'DEREGISTERED');

-- CreateEnum
CREATE TYPE "PeppolTransmissionStatus" AS ENUM ('PENDING', 'TRANSMITTED', 'DELIVERED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractorChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PendingUploadPurpose" AS ENUM ('PORTAL_INVOICE_SUBMIT', 'PORTAL_DOC_VERSION', 'CORE_DOC_REQUEST_UPLOAD', 'CORE_DOC_VERSION_UPLOAD');

-- CreateEnum
CREATE TYPE "TaxIdType" AS ENUM ('GB_VAT', 'DE_USTIDNR');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('valid', 'invalid', 'stale', 'unavailable');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('MANUAL', 'CLOCKIFY', 'JIRA');

-- CreateEnum
CREATE TYPE "WorkflowTemplateType" AS ENUM ('ONBOARDING', 'OFFBOARDING', 'DOCUMENT_COLLECTION', 'COMPLIANCE_REVIEW', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WorkflowTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowTaskType" AS ENUM ('DOCUMENT_COLLECTION', 'APPROVAL', 'ACCESS_GRANT', 'ACCESS_REVOKE', 'FINANCE_SETUP', 'EQUIPMENT', 'KNOWLEDGE_TRANSFER', 'MEETING', 'MANUAL', 'NOTIFICATION', 'IP_VERIFICATION', 'CONTRACT_HEALTH_CHECK');

-- CreateEnum
CREATE TYPE "AssigneeMode" AS ENUM ('FIXED_USER', 'ROLE_BASED', 'CONTRACTOR_OWNER', 'CONTRACT_OWNER', 'PROJECT_MANAGER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'finance_admin', 'ops_manager', 'team_manager', 'legal_compliance_viewer', 'it_admin', 'external_accountant', 'readonly');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'BLOCKED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "WorkflowTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'SKIPPED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ZatcaSubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CLEARED', 'REPORTED', 'REJECTED', 'WARNING');

-- CreateTable
CREATE TABLE "OrganizationApiKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" CHAR(12) NOT NULL,
    "hash" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdByUserId" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalChainConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resourceType" "ApprovalResourceType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "conditionsJson" JSONB,
    "stepsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalChainConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalFlow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "resourceType" "EntityType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "chainConfigId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentStepOrder" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "approvalFlowId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approverUserId" TEXT,
    "approverRole" "UserRole",
    "status" "ApprovalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "required" BOOLEAN NOT NULL,
    "slaDeadline" TIMESTAMP(3),
    "actedAt" TIMESTAMP(3),
    "decision" "ApprovalDecisionType",
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "approvalStepId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "decision" "ApprovalDecisionType" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" "EntityType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceName" TEXT,
    "oldValuesJson" JSONB,
    "newValuesJson" JSONB,
    "metadataJson" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT DEFAULT 'user',
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "outOfOffice" JSONB,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeSubscriptionItemId" TEXT,
    "stripePriceId" TEXT,
    "tier" "SubscriptionTier" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "trialEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "seatCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrCreditLedger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "stripeEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcrCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassificationAssessment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorAssignmentId" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "ruleSetVersion" TEXT NOT NULL,
    "policyRuleSetVersion" TEXT,
    "status" "ClassificationAssessmentStatus" NOT NULL DEFAULT 'draft',
    "questionsSnapshot" JSONB,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "outcome" JSONB,
    "completedAt" TIMESTAMP(3),
    "disclaimerAcknowledgedAt" TIMESTAMP(3),
    "immutableAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassificationAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassificationDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "classificationAssessmentId" TEXT NOT NULL,
    "kind" "ClassificationDocumentKind" NOT NULL,
    "pdfKey" TEXT NOT NULL,
    "sha256Hash" CHAR(64) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "rendererVersion" TEXT NOT NULL,
    "ruleSetVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ir35ChainParticipant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorAssignmentId" TEXT NOT NULL,
    "role" "Ir35ChainRole" NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "linkedOrganizationId" TEXT,
    "linkedContractorId" TEXT,
    "sdsDeliveredAt" TIMESTAMP(3),
    "sdsDeliveredNote" VARCHAR(500),
    "sdsAcknowledgedAt" TIMESTAMP(3),
    "sdsAcknowledgedNote" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ir35ChainParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ir35OtherClientAttestation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorAssignmentId" TEXT NOT NULL,
    "statementText" VARCHAR(4000) NOT NULL,
    "signedName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ir35OtherClientAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomicDependencyAlertState" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorAssignmentId" TEXT NOT NULL,
    "currentBand" "EconomicDependencyBand" NOT NULL DEFAULT 'safe',
    "lastBillingShare" DECIMAL(5,4) NOT NULL,
    "lastScannedAt" TIMESTAMP(3) NOT NULL,
    "lastCrossedAt" TIMESTAMP(3),
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EconomicDependencyAlertState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReassessmentTrigger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorAssignmentId" TEXT NOT NULL,
    "priorAssessmentId" TEXT NOT NULL,
    "priorSdsDocumentId" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggerReasons" JSONB NOT NULL,
    "status" "ReassessmentTriggerStatus" NOT NULL DEFAULT 'OPEN',
    "acknowledgedByUserId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "dismissedByUserId" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "dismissedReason" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReassessmentTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronScanState" (
    "name" VARCHAR(100) NOT NULL,
    "lastScanCompletedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronScanState_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "Statusfeststellungsverfahren" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorAssignmentId" TEXT NOT NULL,
    "filedAt" DATE NOT NULL,
    "drvReference" VARCHAR(100) NOT NULL,
    "outcome" "StatusfeststellungsverfahrenOutcome" NOT NULL DEFAULT 'PENDING',
    "validFrom" DATE,
    "validTo" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Statusfeststellungsverfahren_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassificationEscalationEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contractorId" TEXT,
    "assessmentId" TEXT NOT NULL,
    "verdict" "EscalationVerdict" NOT NULL,
    "triggerKind" "EscalationTriggerKind" NOT NULL,
    "referralTarget" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassificationEscalationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdsApproval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "approvedByUserId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "clientName" TEXT NOT NULL,
    "approvalStatementSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SdsApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyNotice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jurisdiction" CHAR(2) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "contentJson" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "ConsentEventScope" NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "contractNumber" TEXT,
    "title" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "noticePeriodDays" INTEGER,
    "autoRenewal" BOOLEAN NOT NULL DEFAULT false,
    "renewalTerms" TEXT,
    "currency" CHAR(3) NOT NULL,
    "billingModel" "BillingModel" NOT NULL,
    "rateType" "RateType" NOT NULL,
    "rateValueMinor" INTEGER,
    "expectedHoursPerPeriod" DECIMAL(10,2),
    "retainerAmountMinor" INTEGER,
    "paymentTermsDays" INTEGER,
    "invoiceCycle" "InvoiceCycle",
    "expenseReimbursementAllowed" BOOLEAN NOT NULL DEFAULT false,
    "requiresTimesheet" BOOLEAN NOT NULL DEFAULT false,
    "requiresDeliverableAcceptance" BOOLEAN NOT NULL DEFAULT false,
    "internalOwnerUserId" TEXT,
    "teamId" TEXT,
    "projectId" TEXT,
    "costCenterId" TEXT,
    "complianceRiskLevel" "ComplianceRiskLevel",
    "notes" TEXT,
    "signedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "terminationReason" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAmendment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "amendmentNumber" TEXT,
    "title" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "description" TEXT,
    "changesSummaryJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractRatePeriod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "rateType" "RateType" NOT NULL,
    "rateValueMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractRatePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "checksumSha256" VARCHAR(64) NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PRIVATE',
    "uploadedByUserId" TEXT,
    "source" "DocumentSource" NOT NULL,
    "virusScanStatus" "VirusScanStatus" NOT NULL DEFAULT 'PENDING',
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "linkRole" "DocumentLinkRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ContractorType" NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "taxId" TEXT,
    "vatId" TEXT,
    "registrationNumber" TEXT,
    "countryCode" CHAR(2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "status" "ContractorStatus" NOT NULL DEFAULT 'ACTIVE',
    "lifecycleStage" "ContractorLifecycleStage" NOT NULL DEFAULT 'DRAFT',
    "ownerUserId" TEXT,
    "primaryTeamId" TEXT,
    "primaryProjectId" TEXT,
    "defaultCostCenterId" TEXT,
    "workflowRoleId" TEXT,
    "notes" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "customFieldsJson" JSONB,
    "countryFields" JSONB,
    "latestVatValidatedAt" TIMESTAMP(3),
    "latestVatValidationStatus" "ValidationStatus",
    "isPublicSectorBuyer" BOOLEAN NOT NULL DEFAULT false,
    "peppolSchemeId" VARCHAR(4),
    "peppolParticipantValue" VARCHAR(64),
    "isBusinessCustomer" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "preferredPaczkomatId" TEXT,
    "preferredPaczkomatName" TEXT,
    "preferredPaczkomatAddress" TEXT,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "roleTitle" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorBillingProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "legalEntityName" TEXT NOT NULL,
    "billingEmail" TEXT,
    "countryCode" CHAR(2) NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "bankAccountMasked" TEXT,
    "bankAccountEncrypted" TEXT,
    "bankName" TEXT,
    "swiftBic" VARCHAR(11),
    "preferredCurrency" CHAR(3) NOT NULL,
    "paymentTermsDays" INTEGER,
    "taxId" TEXT,
    "vatId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ukSortCodeEncrypted" TEXT,
    "ukSortCodeMasked" TEXT,
    "ukAccountNumberEncrypted" TEXT,
    "ukAccountNumberMasked" TEXT,

    CONSTRAINT "ContractorBillingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "teamId" TEXT,
    "projectId" TEXT,
    "costCenterId" TEXT,
    "ownerUserId" TEXT,
    "allocationPercent" DECIMAL(5,2),
    "activeFrom" DATE NOT NULL,
    "activeTo" DATE,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorTag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" VARCHAR(7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorTagLink" (
    "contractorId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ContractorTagLink_pkey" PRIMARY KEY ("contractorId","tagId")
);

-- CreateTable
CREATE TABLE "ComplianceRequirementTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appliesToContractorType" "ContractorType",
    "documentType" "DocumentType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL,
    "expires" BOOLEAN NOT NULL,
    "defaultValidityDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceRequirementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorComplianceItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "contractId" TEXT,
    "requirementTemplateId" TEXT,
    "name" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'MISSING',
    "severity" "Severity",
    "policyRuleId" TEXT,
    "expiryJurisdictionTz" TEXT,
    "waivedReason" "WaivedReason",
    "dueDate" DATE,
    "satisfiedByDocumentId" TEXT,
    "expiresAt" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorComplianceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeitwegId" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "value" VARCHAR(46) NOT NULL,
    "description" TEXT,
    "contractorId" TEXT,
    "contractId" TEXT,
    "isDefaultForContractor" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeitwegId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoiceLifecycle" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "xmlKey" TEXT,
    "xmlSha256" VARCHAR(64),
    "ruleSetVersion" TEXT,
    "validatedAt" TIMESTAMP(3),
    "validationStatus" "EInvoiceValidationStatus" NOT NULL DEFAULT 'NOT_VALIDATED',
    "validationReportSummary" JSONB,
    "validationReportFullKey" TEXT,
    "transmittedAt" TIMESTAMP(3),
    "transmissionId" TEXT,
    "transmissionStatus" "EInvoiceTransmissionStatus" NOT NULL DEFAULT 'NOT_SENT',
    "deliveredAt" TIMESTAMP(3),
    "deliveryAckJson" JSONB,
    "lastErrorJson" JSONB,
    "zugferdPdfKey" TEXT,
    "zugferdPdfSha256" VARCHAR(64),
    "zugferdGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EInvoiceLifecycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoiceLifecycleEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "lifecycleId" TEXT NOT NULL,
    "eventType" "EInvoiceLifecycleEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerEventId" TEXT,

    CONSTRAINT "EInvoiceLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeppolCapabilityCache" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "documentTypes" JSONB NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeppolCapabilityCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT,
    "type" "EquipmentType" NOT NULL,
    "customType" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "purchaseDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "unassignedByUserId" TEXT,
    "notes" TEXT,

    CONSTRAINT "EquipmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "workflowTaskRunId" TEXT,
    "direction" "ShipmentDirection" NOT NULL,
    "carrier" TEXT NOT NULL,
    "carrierCustom" TEXT,
    "trackingNumber" TEXT,
    "externalId" TEXT,
    "labelUrl" TEXT,
    "expectedDeliveryAt" DATE,
    "currentStatus" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "status" "ReturnRequestStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "targetPointId" TEXT,
    "targetPointName" TEXT,
    "targetPointAddress" TEXT,
    "shipmentId" TEXT,
    "rejectedReason" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "configJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningEnvelope" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationConnectionId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "externalEnvelopeId" TEXT,
    "contractId" TEXT,
    "documentId" TEXT,
    "status" "SigningEnvelopeStatus" NOT NULL DEFAULT 'CREATED',
    "message" TEXT,
    "expiresAt" TIMESTAMP(3),
    "reminderIntervalDays" INTEGER,
    "sentByUserId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SigningEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningRecipient" (
    "id" TEXT NOT NULL,
    "signingEnvelopeId" TEXT NOT NULL,
    "externalRecipientId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "SigningRecipientRole" NOT NULL,
    "routingOrder" INTEGER NOT NULL,
    "status" "SigningRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "signedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "viewedAt" TIMESTAMP(3),

    CONSTRAINT "SigningRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "signingEnvelopeId" TEXT NOT NULL,
    "eventType" "SigningEventType" NOT NULL,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "description" TEXT NOT NULL,
    "providerEventId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "base" CHAR(3) NOT NULL,
    "target" CHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ECB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Export" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "AsyncExportStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT,
    "params" JSONB NOT NULL,
    "fileR2Key" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "rowCount" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Export_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoEBaseRateHistory" (
    "id" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "source" "BoERateSource" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoEBaseRateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkontoTerm" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "billingProfileId" TEXT,
    "discountPercent" DECIMAL(5,2) NOT NULL,
    "discountPeriodDays" INTEGER NOT NULL,
    "netPeriodDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkontoTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkontoSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "skontoTermId" TEXT NOT NULL,
    "eligibilityAtPayment" "SkontoEligibility" NOT NULL,
    "discountAppliedMinor" INTEGER NOT NULL,
    "effectivePaymentDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkontoSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkontoApplication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentRunItemId" TEXT NOT NULL,
    "skontoTermId" TEXT NOT NULL,
    "discountPercentApplied" DECIMAL(5,2) NOT NULL,
    "discountAmountMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkontoApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovApiAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apiName" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "requestBodyHash" TEXT,
    "responseStatus" INTEGER NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovApiAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "displayName" TEXT,
    "configJson" JSONB,
    "scopeCapabilities" JSONB,
    "credentialsRef" TEXT NOT NULL,
    "connectedByUserId" TEXT NOT NULL,
    "userId" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "refreshLockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationConnectionId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "externalType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalUrl" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSyncLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationConnectionId" TEXT NOT NULL,
    "direction" "SyncDirection" NOT NULL,
    "syncType" TEXT NOT NULL,
    "entityType" "EntityType",
    "entityId" TEXT,
    "status" "SyncStatus" NOT NULL,
    "requestPayloadJson" JSONB,
    "responsePayloadJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationConnectionId" TEXT,
    "provider" "IntegrationProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "deliveryStatus" "WebhookDeliveryStatus" NOT NULL DEFAULT 'RECEIVED',
    "signatureValid" BOOLEAN,
    "payloadJson" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "providerEventId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT,
    "contractId" TEXT,
    "billingProfileId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "externalInvoiceId" TEXT,
    "source" "InvoiceSource" NOT NULL,
    "sourceReference" TEXT,
    "issueDate" DATE NOT NULL,
    "servicePeriodStart" DATE,
    "servicePeriodEnd" DATE,
    "dueDate" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "vatRate" TEXT,
    "vatAmountMinor" INTEGER,
    "totalMinor" INTEGER NOT NULL,
    "withholdingMinor" INTEGER,
    "isReverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "reverseChargeOverride" BOOLEAN,
    "amountToPayMinor" INTEGER NOT NULL,
    "sellerTaxId" VARCHAR(50),
    "sellerName" VARCHAR(500),
    "sellerBankAccount" VARCHAR(34),
    "buyerTaxId" VARCHAR(50),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'RECEIVED',
    "matchStatus" "InvoiceMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_READY',
    "duplicateCheckHash" VARCHAR(64),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "readyForPaymentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "submittedByEmail" TEXT,
    "notes" TEXT,
    "flagsJson" JSONB,
    "qrCodeBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "role" "InvoiceFileRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4),
    "unit" TEXT,
    "unitPriceMinor" INTEGER,
    "netAmountMinor" INTEGER,
    "vatRate" TEXT,
    "vatAmountMinor" INTEGER,
    "grossAmountMinor" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceMatchResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "matchedContractId" TEXT,
    "matchedContractorId" TEXT,
    "matchScore" DECIMAL(5,2),
    "expectedAmountMinor" INTEGER,
    "expectedCurrency" CHAR(3),
    "amountDeltaMinor" INTEGER,
    "amountDeltaPercent" DECIMAL(8,4),
    "matchedBy" "MatchBy" NOT NULL,
    "status" "InvoiceMatchStatus" NOT NULL,
    "explanationJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "InvoiceMatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceIntakeRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "sourceKind" "InvoiceIntakeSourceKind" NOT NULL,
    "rawFileKey" TEXT NOT NULL,
    "rawFileSha256" VARCHAR(64) NOT NULL,
    "rawFileMime" VARCHAR(64) NOT NULL,
    "rawFileSizeBytes" INTEGER NOT NULL,
    "extractedXmlKey" TEXT,
    "validationReportKey" TEXT,
    "profileLevel" "InvoiceIntakeProfileLevel" NOT NULL,
    "parsedInvoiceJson" JSONB NOT NULL,
    "extractedSupplierName" TEXT,
    "extractedSupplierVatId" TEXT,
    "extractedSupplierLeitwegId" TEXT,
    "extractedInvoiceNumber" TEXT,
    "extractedInvoiceDate" TIMESTAMP(3),
    "extractedTotalMinor" BIGINT,
    "extractedCurrency" CHAR(3),
    "matchedContractorId" TEXT,
    "matchedContractId" TEXT,
    "convertedInvoiceId" TEXT,
    "status" "InvoiceIntakeStatus" NOT NULL DEFAULT 'PARSED',
    "validationStatus" "InvoiceIntakeValidationStatus" NOT NULL DEFAULT 'VALID',
    "validationAcknowledgedAt" TIMESTAMP(3),
    "validationAcknowledgedByUserId" TEXT,
    "rejectionReason" TEXT,
    "unmappedFieldsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceIntakeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "sourceKind" "InvoicePaymentSourceKind" NOT NULL,
    "sourcePaymentRunItemId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceInterestCompensation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "tierMinor" INTEGER NOT NULL,
    "invoiceTotalAtOverdueMinor" INTEGER NOT NULL,
    "firstOverdueDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceInterestCompensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceInterestWaiver" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "waiveType" "InterestWaiveType" NOT NULL,
    "reason" TEXT NOT NULL,
    "waivedByUserId" TEXT NOT NULL,
    "waivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceInterestWaiver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceInterestClaim" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "claimedByUserId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotInterestMinor" INTEGER NOT NULL,
    "snapshotCompensationMinor" INTEGER NOT NULL,
    "snapshotRateUsed" DECIMAL(5,2) NOT NULL,
    "snapshotDaysOverdue" INTEGER NOT NULL,
    "pdfKey" TEXT,
    "pdfStatus" "InvoiceInterestClaimPdfStatus" NOT NULL DEFAULT 'PENDING_RENDER',
    "pdfError" TEXT,
    "pdfReadyAt" TIMESTAMP(3),
    "secondaryInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceInterestClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" "EntityType",
    "entityId" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "dedupKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "channelEmail" BOOLEAN NOT NULL DEFAULT true,
    "channelSlack" BOOLEAN NOT NULL DEFAULT true,
    "channelTeams" BOOLEAN NOT NULL DEFAULT false,
    "channelInApp" BOOLEAN NOT NULL DEFAULT true,
    "digestMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "triggerType" "ReminderTriggerType" NOT NULL,
    "offsetDays" INTEGER,
    "offsetHours" INTEGER,
    "channel" "NotificationChannel" NOT NULL,
    "recipientMode" "RecipientMode" NOT NULL,
    "configJson" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderInstance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reminderRuleId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "ReminderInstanceStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationCronDedup" (
    "id" TEXT NOT NULL,
    "dedupeKey" VARCHAR(512) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationCronDedup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthChallenge" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "pkceVerifier" TEXT,
    "redirectUri" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrExtraction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "documentId" TEXT NOT NULL,
    "provider" "OcrProvider" NOT NULL DEFAULT 'CLAUDE',
    "status" "OcrExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "resultJson" JSONB,
    "overallConfidence" DECIMAL(5,2),
    "pageCount" INTEGER,
    "processingTimeMs" INTEGER,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OcrExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legalName" TEXT,
    "countryCode" CHAR(2),
    "dataRegion" "DataRegion" NOT NULL DEFAULT 'EU',
    "defaultCurrency" CHAR(3),
    "timezone" TEXT,
    "language" TEXT,
    "fiscalYearStartMonth" INTEGER DEFAULT 1,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "isKleinunternehmer" BOOLEAN NOT NULL DEFAULT false,
    "billingEmail" TEXT,
    "bacsServiceUserNumberEncrypted" TEXT,
    "bacsServiceUserNumberMasked" TEXT,
    "bacsSubmitterSortCodeEncrypted" TEXT,
    "bacsSubmitterSortCodeMasked" TEXT,
    "bacsSubmitterAccountNumberEncrypted" TEXT,
    "bacsSubmitterAccountNumberMasked" TEXT,
    "bacsSubmitterName" VARCHAR(18),
    "settingsJson" JSONB,
    "expertReferralEmail" TEXT,
    "portalSubdomain" TEXT,
    "portalCustomDomain" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),
    "disabledByUserId" TEXT,
    "disabledReason" TEXT,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "inviterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "managerUserId" TEXT,
    "fallbackApproverId" TEXT,
    "status" "SimpleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "teamId" TEXT,
    "status" "SimpleStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE,
    "endDate" DATE,
    "budgetMinor" INTEGER,
    "budgetCurrency" CHAR(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "SimpleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT,
    "aggregateId" TEXT,
    "payloadJson" JSONB NOT NULL,
    "dedupKey" TEXT,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runNumber" TEXT,
    "name" TEXT,
    "status" "PaymentRunStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3),
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "invoiceCount" INTEGER NOT NULL DEFAULT 0,
    "exportFormat" "PaymentExportFormat",
    "exportedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRunItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentRunId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "billingProfileId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentRunItemStatus" NOT NULL DEFAULT 'PENDING',
    "paymentReference" TEXT,
    "markedPaidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "whtAmountMinor" INTEGER,
    "whtRate" DECIMAL(5,2),
    "whtTreatyApplied" BOOLEAN,
    "whtTreatyReference" VARCHAR(100),
    "whtServiceType" VARCHAR(50),
    "grossAmountMinor" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentExport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentRunId" TEXT NOT NULL,
    "documentId" TEXT,
    "format" "PaymentExportFormat" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'GENERATED',
    "generatedByUserId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeppolParticipant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "identifierValue" TEXT NOT NULL,
    "aspProvider" TEXT NOT NULL,
    "aspRegistrationId" TEXT,
    "status" "PeppolParticipantStatus" NOT NULL DEFAULT 'PENDING',
    "registeredAt" TIMESTAMP(3),
    "supportsXRechnungCii" BOOLEAN NOT NULL DEFAULT false,
    "lastCapabilityCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeppolParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeppolTransmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "peppolParticipantId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "direction" "SyncDirection" NOT NULL,
    "aspTransmissionId" TEXT,
    "documentTypeId" TEXT,
    "status" "PeppolTransmissionStatus" NOT NULL DEFAULT 'PENDING',
    "xmlPayload" TEXT,
    "errorMessage" TEXT,
    "transmittedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeppolTransmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalMagicToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalMagicToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorChangeRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "status" "ContractorChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedChanges" JSONB NOT NULL,
    "previousValues" JSONB NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorNotificationPreference" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingUpload" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytesMax" INTEGER,
    "purpose" "PendingUploadPurpose" NOT NULL,
    "createdByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "description" VARCHAR(100) NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isReverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "isExempt" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithholdingTaxRate" (
    "id" TEXT NOT NULL,
    "sourceCountry" CHAR(2) NOT NULL,
    "contractorResidency" CHAR(2) NOT NULL,
    "serviceType" VARCHAR(50) NOT NULL,
    "standardRate" DECIMAL(5,2) NOT NULL,
    "treatyRate" DECIMAL(5,2),
    "treatyReference" VARCHAR(100),
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithholdingTaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhtCertificate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentRunItemId" TEXT NOT NULL,
    "certificateNumber" VARCHAR(50) NOT NULL,
    "documentId" TEXT,
    "grossAmountMinor" INTEGER NOT NULL,
    "whtRate" DECIMAL(5,2) NOT NULL,
    "whtAmountMinor" INTEGER NOT NULL,
    "netAmountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "contractorName" TEXT NOT NULL,
    "contractorTaxId" TEXT,
    "contractorCountry" CHAR(2) NOT NULL,
    "treatyApplied" BOOLEAN NOT NULL DEFAULT false,
    "treatyReference" VARCHAR(100),
    "paymentDate" DATE NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByUserId" TEXT NOT NULL,

    CONSTRAINT "WhtCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxIdValidation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "taxIdType" "TaxIdType" NOT NULL,
    "taxIdValue" VARCHAR(20) NOT NULL,
    "apiProvider" VARCHAR(20) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "confirmationRef" VARCHAR(50),
    "responseStatus" "ValidationStatus" NOT NULL,
    "responseBody" JSONB NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "TaxIdValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "description" TEXT,
    "source" "TimeEntrySource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkflowTemplateType" NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL,
    "status" "WorkflowTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "appliesToEntityType" "EntityType" NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTaskTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowTemplateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskType" "WorkflowTaskType" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL,
    "assigneeMode" "AssigneeMode" NOT NULL,
    "assigneeRole" "UserRole",
    "assigneeUserId" TEXT,
    "dueOffsetDays" INTEGER,
    "dueOffsetHours" INTEGER,
    "dependsOnTaskTemplateId" TEXT,
    "externalUrl" TEXT,
    "configJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRoleTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "displayNameI18nKey" TEXT,
    "displayNameEn" TEXT,
    "displayNamePl" TEXT,
    "displayNameDe" TEXT,
    "isSeed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRoleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRoleTaskTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowRoleTemplateId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "titleI18nKey" TEXT,
    "descriptionI18nKey" TEXT,
    "titleEn" TEXT,
    "titlePl" TEXT,
    "titleDe" TEXT,
    "descriptionEn" TEXT,
    "descriptionPl" TEXT,
    "descriptionDe" TEXT,
    "dueDayOffset" INTEGER NOT NULL,
    "requiredDocsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRoleTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowTemplateId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "contractorId" TEXT,
    "contractId" TEXT,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedByUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "progressPercent" INTEGER,
    "overriddenTemplateId" TEXT,
    "overriddenByUserId" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "overrideMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTaskRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "workflowTaskTemplateId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskType" "WorkflowTaskType" NOT NULL,
    "status" "WorkflowTaskStatus" NOT NULL DEFAULT 'TODO',
    "required" BOOLEAN NOT NULL,
    "assigneeUserId" TEXT,
    "assigneeRole" "UserRole",
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "dependsOnTaskRunId" TEXT,
    "resultJson" JSONB,
    "externalRefType" TEXT,
    "externalRefId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTaskRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowComment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "workflowTaskRunId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "workflowTaskRunId" TEXT,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZatcaInvoiceChain" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "icv" INTEGER NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceHash" TEXT NOT NULL,
    "previousHash" TEXT NOT NULL,
    "zatcaUuid" TEXT NOT NULL,
    "zatcaStatus" "ZatcaSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "zatcaResponse" JSONB,
    "submittedAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZatcaInvoiceChain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationApiKey_prefix_revokedAt_idx" ON "OrganizationApiKey"("prefix", "revokedAt");

-- CreateIndex
CREATE INDEX "OrganizationApiKey_organizationId_revokedAt_idx" ON "OrganizationApiKey"("organizationId", "revokedAt");

-- CreateIndex
CREATE INDEX "ApprovalChainConfig_organizationId_idx" ON "ApprovalChainConfig"("organizationId");

-- CreateIndex
CREATE INDEX "ApprovalChainConfig_organizationId_resourceType_isActive_idx" ON "ApprovalChainConfig"("organizationId", "resourceType", "isActive");

-- CreateIndex
CREATE INDEX "ApprovalFlow_organizationId_idx" ON "ApprovalFlow"("organizationId");

-- CreateIndex
CREATE INDEX "ApprovalFlow_organizationId_resourceType_resourceId_idx" ON "ApprovalFlow"("organizationId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "ApprovalFlow_organizationId_status_idx" ON "ApprovalFlow"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ApprovalStep_organizationId_idx" ON "ApprovalStep"("organizationId");

-- CreateIndex
CREATE INDEX "ApprovalStep_organizationId_approverUserId_status_idx" ON "ApprovalStep"("organizationId", "approverUserId", "status");

-- CreateIndex
CREATE INDEX "ApprovalStep_organizationId_status_createdAt_idx" ON "ApprovalStep"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStep_approvalFlowId_stepOrder_key" ON "ApprovalStep"("approvalFlowId", "stepOrder");

-- CreateIndex
CREATE INDEX "ApprovalDecision_organizationId_idx" ON "ApprovalDecision"("organizationId");

-- CreateIndex
CREATE INDEX "ApprovalDecision_organizationId_approvalStepId_idx" ON "ApprovalDecision"("organizationId", "approvalStepId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_resourceType_resourceId_createdAt_idx" ON "AuditLog"("organizationId", "resourceType", "resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_actorId_createdAt_idx" ON "AuditLog"("organizationId", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "Verification_expiresAt_idx" ON "Verification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "OcrCreditLedger_organizationId_idx" ON "OcrCreditLedger"("organizationId");

-- CreateIndex
CREATE INDEX "OcrCreditLedger_organizationId_periodStart_periodEnd_idx" ON "OcrCreditLedger"("organizationId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "OcrCreditLedger_stripeEventId_unique" ON "OcrCreditLedger"("stripeEventId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeEvent_stripeEventId_key" ON "StripeEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "StripeEvent_eventType_idx" ON "StripeEvent"("eventType");

-- CreateIndex
CREATE INDEX "ClassificationAssessment_organizationId_idx" ON "ClassificationAssessment"("organizationId");

-- CreateIndex
CREATE INDEX "CA_org_assign_status_idx" ON "ClassificationAssessment"("organizationId", "contractorAssignmentId", "status");

-- CreateIndex
CREATE INDEX "CA_org_assign_completedAt_idx" ON "ClassificationAssessment"("organizationId", "contractorAssignmentId", "completedAt" DESC);

-- CreateIndex
CREATE INDEX "ClassificationDocument_organizationId_classificationAssessm_idx" ON "ClassificationDocument"("organizationId", "classificationAssessmentId", "kind");

-- CreateIndex
CREATE INDEX "ClassificationDocument_organizationId_generatedAt_idx" ON "ClassificationDocument"("organizationId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "Ir35ChainParticipant_organizationId_contractorAssignmentId__idx" ON "Ir35ChainParticipant"("organizationId", "contractorAssignmentId", "orderIndex");

-- CreateIndex
CREATE INDEX "Ir35ChainParticipant_organizationId_linkedOrganizationId_idx" ON "Ir35ChainParticipant"("organizationId", "linkedOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Ir35OtherClientAttestation_contractorAssignmentId_key" ON "Ir35OtherClientAttestation"("contractorAssignmentId");

-- CreateIndex
CREATE INDEX "Ir35OtherClientAttestation_organizationId_contractorAssignm_idx" ON "Ir35OtherClientAttestation"("organizationId", "contractorAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "EconomicDependencyAlertState_contractorAssignmentId_key" ON "EconomicDependencyAlertState"("contractorAssignmentId");

-- CreateIndex
CREATE INDEX "EDAS_org_idx" ON "EconomicDependencyAlertState"("organizationId");

-- CreateIndex
CREATE INDEX "EDAS_org_band_idx" ON "EconomicDependencyAlertState"("organizationId", "currentBand");

-- CreateIndex
CREATE INDEX "EDAS_org_scanned_idx" ON "EconomicDependencyAlertState"("organizationId", "lastScannedAt");

-- CreateIndex
CREATE INDEX "RT_org_assign_status_idx" ON "ReassessmentTrigger"("organizationId", "contractorAssignmentId", "status");

-- CreateIndex
CREATE INDEX "RT_org_triggeredAt_idx" ON "ReassessmentTrigger"("organizationId", "triggeredAt");

-- CreateIndex
CREATE INDEX "SFV_org_assign_idx" ON "Statusfeststellungsverfahren"("organizationId", "contractorAssignmentId");

-- CreateIndex
CREATE INDEX "SFV_org_validTo_idx" ON "Statusfeststellungsverfahren"("organizationId", "validTo");

-- CreateIndex
CREATE INDEX "CEE_org_createdAt_idx" ON "ClassificationEscalationEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "CEE_org_assessment_idx" ON "ClassificationEscalationEvent"("organizationId", "assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SdsApproval_assessmentId_key" ON "SdsApproval"("assessmentId");

-- CreateIndex
CREATE INDEX "SDS_org_idx" ON "SdsApproval"("organizationId");

-- CreateIndex
CREATE INDEX "SDS_org_assessment_idx" ON "SdsApproval"("organizationId", "assessmentId");

-- CreateIndex
CREATE INDEX "ConsentRecord_organizationId_idx" ON "ConsentRecord"("organizationId");

-- CreateIndex
CREATE INDEX "ConsentRecord_organizationId_userId_purpose_idx" ON "ConsentRecord"("organizationId", "userId", "purpose");

-- CreateIndex
CREATE INDEX "ConsentRecord_organizationId_purpose_createdAt_idx" ON "ConsentRecord"("organizationId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "PrivacyNotice_organizationId_jurisdiction_idx" ON "PrivacyNotice"("organizationId", "jurisdiction");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyNotice_organizationId_jurisdiction_version_key" ON "PrivacyNotice"("organizationId", "jurisdiction", "version");

-- CreateIndex
CREATE INDEX "CE_org_user_scope_idx" ON "ConsentEvent"("organizationId", "userId", "scope");

-- CreateIndex
CREATE INDEX "CE_org_scope_createdAt_idx" ON "ConsentEvent"("organizationId", "scope", "createdAt");

-- CreateIndex
CREATE INDEX "Contract_organizationId_idx" ON "Contract"("organizationId");

-- CreateIndex
CREATE INDEX "Contract_organizationId_contractorId_status_idx" ON "Contract"("organizationId", "contractorId", "status");

-- CreateIndex
CREATE INDEX "Contract_organizationId_endDate_idx" ON "Contract"("organizationId", "endDate");

-- CreateIndex
CREATE INDEX "Contract_organizationId_internalOwnerUserId_idx" ON "Contract"("organizationId", "internalOwnerUserId");

-- CreateIndex
CREATE INDEX "Contract_organizationId_status_idx" ON "Contract"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Contract_organizationId_billingModel_idx" ON "Contract"("organizationId", "billingModel");

-- CreateIndex
CREATE INDEX "Contract_organizationId_teamId_idx" ON "Contract"("organizationId", "teamId");

-- CreateIndex
CREATE INDEX "Contract_organizationId_projectId_idx" ON "Contract"("organizationId", "projectId");

-- CreateIndex
CREATE INDEX "ContractAmendment_organizationId_idx" ON "ContractAmendment"("organizationId");

-- CreateIndex
CREATE INDEX "ContractAmendment_organizationId_contractId_idx" ON "ContractAmendment"("organizationId", "contractId");

-- CreateIndex
CREATE INDEX "ContractRatePeriod_organizationId_idx" ON "ContractRatePeriod"("organizationId");

-- CreateIndex
CREATE INDEX "ContractRatePeriod_organizationId_contractId_idx" ON "ContractRatePeriod"("organizationId", "contractId");

-- CreateIndex
CREATE INDEX "ContractRatePeriod_organizationId_validFrom_validTo_idx" ON "ContractRatePeriod"("organizationId", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");

-- CreateIndex
CREATE INDEX "Document_organizationId_documentType_status_idx" ON "Document"("organizationId", "documentType", "status");

-- CreateIndex
CREATE INDEX "Document_organizationId_checksumSha256_idx" ON "Document"("organizationId", "checksumSha256");

-- CreateIndex
CREATE INDEX "DocumentLink_organizationId_idx" ON "DocumentLink"("organizationId");

-- CreateIndex
CREATE INDEX "DocumentLink_organizationId_entityType_entityId_idx" ON "DocumentLink"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "DocumentLink_organizationId_documentId_idx" ON "DocumentLink"("organizationId", "documentId");

-- CreateIndex
CREATE INDEX "Contractor_organizationId_idx" ON "Contractor"("organizationId");

-- CreateIndex
CREATE INDEX "Contractor_organizationId_status_idx" ON "Contractor"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Contractor_organizationId_lifecycleStage_idx" ON "Contractor"("organizationId", "lifecycleStage");

-- CreateIndex
CREATE INDEX "Contractor_organizationId_ownerUserId_idx" ON "Contractor"("organizationId", "ownerUserId");

-- CreateIndex
CREATE INDEX "Contractor_organizationId_legalName_idx" ON "Contractor"("organizationId", "legalName");

-- CreateIndex
CREATE INDEX "Contractor_organizationId_taxId_idx" ON "Contractor"("organizationId", "taxId");

-- CreateIndex
CREATE INDEX "Contractor_organizationId_workflowRoleId_idx" ON "Contractor"("organizationId", "workflowRoleId");

-- CreateIndex
CREATE INDEX "ContractorContact_organizationId_idx" ON "ContractorContact"("organizationId");

-- CreateIndex
CREATE INDEX "ContractorContact_organizationId_contractorId_idx" ON "ContractorContact"("organizationId", "contractorId");

-- CreateIndex
CREATE INDEX "ContractorBillingProfile_organizationId_idx" ON "ContractorBillingProfile"("organizationId");

-- CreateIndex
CREATE INDEX "ContractorBillingProfile_organizationId_contractorId_idx" ON "ContractorBillingProfile"("organizationId", "contractorId");

-- CreateIndex
CREATE INDEX "ContractorBillingProfile_organizationId_isDefault_idx" ON "ContractorBillingProfile"("organizationId", "isDefault");

-- CreateIndex
CREATE INDEX "ContractorAssignment_organizationId_idx" ON "ContractorAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "ContractorAssignment_organizationId_contractorId_status_idx" ON "ContractorAssignment"("organizationId", "contractorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorTag_organizationId_name_key" ON "ContractorTag"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ContractorTagLink_tagId_idx" ON "ContractorTagLink"("tagId");

-- CreateIndex
CREATE INDEX "ComplianceRequirementTemplate_organizationId_idx" ON "ComplianceRequirementTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "ContractorComplianceItem_organizationId_idx" ON "ContractorComplianceItem"("organizationId");

-- CreateIndex
CREATE INDEX "ContractorComplianceItem_organizationId_contractorId_status_idx" ON "ContractorComplianceItem"("organizationId", "contractorId", "status");

-- CreateIndex
CREATE INDEX "ContractorComplianceItem_organizationId_expiresAt_idx" ON "ContractorComplianceItem"("organizationId", "expiresAt");

-- CreateIndex
CREATE INDEX "ContractorComplianceItem_organizationId_policyRuleId_idx" ON "ContractorComplianceItem"("organizationId", "policyRuleId");

-- CreateIndex
CREATE INDEX "leitweg_id_org_contractor_idx" ON "LeitwegId"("organizationId", "contractorId");

-- CreateIndex
CREATE INDEX "leitweg_id_org_contract_idx" ON "LeitwegId"("organizationId", "contractId");

-- CreateIndex
CREATE UNIQUE INDEX "leitweg_id_org_value_uniq" ON "LeitwegId"("organizationId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoiceLifecycle_invoiceId_key" ON "EInvoiceLifecycle"("invoiceId");

-- CreateIndex
CREATE INDEX "einvoice_lifecycle_org_val_idx" ON "EInvoiceLifecycle"("organizationId", "validationStatus");

-- CreateIndex
CREATE INDEX "einvoice_lifecycle_org_tx_idx" ON "EInvoiceLifecycle"("organizationId", "transmissionStatus");

-- CreateIndex
CREATE INDEX "einvoice_lifecycle_event_org_lc_idx" ON "EInvoiceLifecycleEvent"("organizationId", "lifecycleId");

-- CreateIndex
CREATE INDEX "einvoice_lifecycle_event_org_type_idx" ON "EInvoiceLifecycleEvent"("organizationId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "einvoice_lifecycle_event_org_eid_uniq" ON "EInvoiceLifecycleEvent"("organizationId", "providerEventId");

-- CreateIndex
CREATE INDEX "peppol_capability_cache_org_expiry_idx" ON "PeppolCapabilityCache"("organizationId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "peppol_capability_cache_org_scheme_value_uniq" ON "PeppolCapabilityCache"("organizationId", "schemeId", "value");

-- CreateIndex
CREATE INDEX "Equipment_organizationId_idx" ON "Equipment"("organizationId");

-- CreateIndex
CREATE INDEX "Equipment_organizationId_status_idx" ON "Equipment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Equipment_organizationId_type_idx" ON "Equipment"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_organizationId_serialNumber_key" ON "Equipment"("organizationId", "serialNumber");

-- CreateIndex
CREATE INDEX "EquipmentAssignment_organizationId_idx" ON "EquipmentAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "EquipmentAssignment_organizationId_equipmentId_idx" ON "EquipmentAssignment"("organizationId", "equipmentId");

-- CreateIndex
CREATE INDEX "EquipmentAssignment_organizationId_contractorId_idx" ON "EquipmentAssignment"("organizationId", "contractorId");

-- CreateIndex
CREATE INDEX "EquipmentAssignment_organizationId_equipmentId_unassignedAt_idx" ON "EquipmentAssignment"("organizationId", "equipmentId", "unassignedAt");

-- CreateIndex
CREATE INDEX "Shipment_organizationId_idx" ON "Shipment"("organizationId");

-- CreateIndex
CREATE INDEX "Shipment_organizationId_equipmentId_idx" ON "Shipment"("organizationId", "equipmentId");

-- CreateIndex
CREATE INDEX "Shipment_organizationId_currentStatus_idx" ON "Shipment"("organizationId", "currentStatus");

-- CreateIndex
CREATE INDEX "Shipment_organizationId_workflowTaskRunId_idx" ON "Shipment"("organizationId", "workflowTaskRunId");

-- CreateIndex
CREATE INDEX "Shipment_organizationId_carrier_currentStatus_idx" ON "Shipment"("organizationId", "carrier", "currentStatus");

-- CreateIndex
CREATE INDEX "ShipmentEvent_organizationId_idx" ON "ShipmentEvent"("organizationId");

-- CreateIndex
CREATE INDEX "ShipmentEvent_organizationId_shipmentId_occurredAt_idx" ON "ShipmentEvent"("organizationId", "shipmentId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_shipmentId_key" ON "ReturnRequest"("shipmentId");

-- CreateIndex
CREATE INDEX "ReturnRequest_organizationId_idx" ON "ReturnRequest"("organizationId");

-- CreateIndex
CREATE INDEX "ReturnRequest_organizationId_contractorId_idx" ON "ReturnRequest"("organizationId", "contractorId");

-- CreateIndex
CREATE INDEX "ReturnRequest_organizationId_status_idx" ON "ReturnRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CourierConfig_organizationId_idx" ON "CourierConfig"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CourierConfig_organizationId_carrier_key" ON "CourierConfig"("organizationId", "carrier");

-- CreateIndex
CREATE INDEX "SigningEnvelope_organizationId_idx" ON "SigningEnvelope"("organizationId");

-- CreateIndex
CREATE INDEX "SigningEnvelope_organizationId_contractId_idx" ON "SigningEnvelope"("organizationId", "contractId");

-- CreateIndex
CREATE INDEX "SigningEnvelope_organizationId_status_idx" ON "SigningEnvelope"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "signing_envelope_provider_external_id_uniq" ON "SigningEnvelope"("provider", "externalEnvelopeId");

-- CreateIndex
CREATE INDEX "SigningRecipient_signingEnvelopeId_idx" ON "SigningRecipient"("signingEnvelopeId");

-- CreateIndex
CREATE INDEX "SigningEvent_organizationId_signingEnvelopeId_occurredAt_idx" ON "SigningEvent"("organizationId", "signingEnvelopeId", "occurredAt");

-- CreateIndex
CREATE INDEX "ExchangeRate_date_idx" ON "ExchangeRate"("date");

-- CreateIndex
CREATE INDEX "ExchangeRate_target_date_idx" ON "ExchangeRate"("target", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_date_base_target_key" ON "ExchangeRate"("date", "base", "target");

-- CreateIndex
CREATE INDEX "Export_organizationId_createdAt_idx" ON "Export"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Export_status_expiresAt_idx" ON "Export"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Export_organizationId_requestedByUserId_createdAt_idx" ON "Export"("organizationId", "requestedByUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BoEBaseRateHistory_effectiveFrom_key" ON "BoEBaseRateHistory"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SkontoTerm_invoiceId_key" ON "SkontoTerm"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SkontoTerm_billingProfileId_key" ON "SkontoTerm"("billingProfileId");

-- CreateIndex
CREATE INDEX "SkontoTerm_organizationId_idx" ON "SkontoTerm"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SkontoSnapshot_invoiceId_key" ON "SkontoSnapshot"("invoiceId");

-- CreateIndex
CREATE INDEX "SkontoSnapshot_organizationId_idx" ON "SkontoSnapshot"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SkontoApplication_paymentRunItemId_key" ON "SkontoApplication"("paymentRunItemId");

-- CreateIndex
CREATE INDEX "SkontoApplication_organizationId_idx" ON "SkontoApplication"("organizationId");

-- CreateIndex
CREATE INDEX "GovApiAuditLog_organizationId_idx" ON "GovApiAuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "GovApiAuditLog_organizationId_apiName_idx" ON "GovApiAuditLog"("organizationId", "apiName");

-- CreateIndex
CREATE INDEX "GovApiAuditLog_apiName_createdAt_idx" ON "GovApiAuditLog"("apiName", "createdAt");

-- CreateIndex
CREATE INDEX "GovApiAuditLog_createdAt_idx" ON "GovApiAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "IntegrationConnection_organizationId_idx" ON "IntegrationConnection"("organizationId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_organizationId_provider_status_idx" ON "IntegrationConnection"("organizationId", "provider", "status");

-- CreateIndex
CREATE INDEX "IntegrationConnection_organizationId_userId_provider_idx" ON "IntegrationConnection"("organizationId", "userId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationConnection_status_tokenExpiresAt_idx" ON "IntegrationConnection"("status", "tokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "integration_connection_org_provider_user_uniq" ON "IntegrationConnection"("organizationId", "provider", "userId");

-- CreateIndex
CREATE INDEX "ExternalLink_organizationId_idx" ON "ExternalLink"("organizationId");

-- CreateIndex
CREATE INDEX "ExternalLink_organizationId_entityType_entityId_idx" ON "ExternalLink"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ExternalLink_organizationId_integrationConnectionId_idx" ON "ExternalLink"("organizationId", "integrationConnectionId");

-- CreateIndex
CREATE INDEX "IntegrationSyncLog_organizationId_idx" ON "IntegrationSyncLog"("organizationId");

-- CreateIndex
CREATE INDEX "IntegrationSyncLog_organizationId_integrationConnectionId_s_idx" ON "IntegrationSyncLog"("organizationId", "integrationConnectionId", "startedAt");

-- CreateIndex
CREATE INDEX "IntegrationSyncLog_organizationId_status_idx" ON "IntegrationSyncLog"("organizationId", "status");

-- CreateIndex
CREATE INDEX "WebhookDelivery_organizationId_idx" ON "WebhookDelivery"("organizationId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_organizationId_provider_receivedAt_idx" ON "WebhookDelivery"("organizationId", "provider", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_deliveryStatus_nextAttemptAt_idx" ON "WebhookDelivery"("deliveryStatus", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_delivery_provider_event_uniq" ON "WebhookDelivery"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_status_idx" ON "Invoice"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_approvalStatus_idx" ON "Invoice"("organizationId", "approvalStatus");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_paymentStatus_idx" ON "Invoice"("organizationId", "paymentStatus");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_dueDate_idx" ON "Invoice"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_contractorId_idx" ON "Invoice"("organizationId", "contractorId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_contractId_idx" ON "Invoice"("organizationId", "contractId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_receivedAt_idx" ON "Invoice"("organizationId", "receivedAt");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_sellerTaxId_idx" ON "Invoice"("organizationId", "sellerTaxId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_matchStatus_idx" ON "Invoice"("organizationId", "matchStatus");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_paymentStatus_dueDate_idx" ON "Invoice"("organizationId", "paymentStatus", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_duplicateCheckHash_key" ON "Invoice"("organizationId", "duplicateCheckHash");

-- CreateIndex
CREATE INDEX "InvoiceFile_organizationId_idx" ON "InvoiceFile"("organizationId");

-- CreateIndex
CREATE INDEX "InvoiceFile_organizationId_invoiceId_idx" ON "InvoiceFile"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLine_organizationId_idx" ON "InvoiceLine"("organizationId");

-- CreateIndex
CREATE INDEX "InvoiceLine_organizationId_invoiceId_idx" ON "InvoiceLine"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceMatchResult_organizationId_idx" ON "InvoiceMatchResult"("organizationId");

-- CreateIndex
CREATE INDEX "InvoiceMatchResult_organizationId_invoiceId_idx" ON "InvoiceMatchResult"("organizationId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceIntakeRequest_convertedInvoiceId_key" ON "InvoiceIntakeRequest"("convertedInvoiceId");

-- CreateIndex
CREATE INDEX "invoice_intake_org_status_idx" ON "InvoiceIntakeRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "invoice_intake_org_vat_idx" ON "InvoiceIntakeRequest"("organizationId", "extractedSupplierVatId");

-- CreateIndex
CREATE INDEX "invoice_intake_org_created_idx" ON "InvoiceIntakeRequest"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_intake_org_sha_uniq" ON "InvoiceIntakeRequest"("organizationId", "rawFileSha256");

-- CreateIndex
CREATE INDEX "InvoicePayment_organizationId_invoiceId_idx" ON "InvoicePayment"("organizationId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceInterestCompensation_invoiceId_key" ON "InvoiceInterestCompensation"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceInterestCompensation_organizationId_idx" ON "InvoiceInterestCompensation"("organizationId");

-- CreateIndex
CREATE INDEX "InvoiceInterestWaiver_organizationId_invoiceId_idx" ON "InvoiceInterestWaiver"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceInterestClaim_organizationId_invoiceId_idx" ON "InvoiceInterestClaim"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceInterestClaim_pdfStatus_createdAt_idx" ON "InvoiceInterestClaim"("pdfStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");

-- CreateIndex
CREATE INDEX "Notification_organizationId_userId_status_idx" ON "Notification"("organizationId", "userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_organizationId_dedupKey_key" ON "Notification"("organizationId", "dedupKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationPreference_organizationId_userId_notificati_key" ON "UserNotificationPreference"("organizationId", "userId", "notificationType");

-- CreateIndex
CREATE INDEX "Comment_organizationId_idx" ON "Comment"("organizationId");

-- CreateIndex
CREATE INDEX "Comment_organizationId_entityType_entityId_createdAt_idx" ON "Comment"("organizationId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "ReminderRule_organizationId_idx" ON "ReminderRule"("organizationId");

-- CreateIndex
CREATE INDEX "ReminderRule_organizationId_active_idx" ON "ReminderRule"("organizationId", "active");

-- CreateIndex
CREATE INDEX "ReminderInstance_organizationId_idx" ON "ReminderInstance"("organizationId");

-- CreateIndex
CREATE INDEX "ReminderInstance_organizationId_scheduledFor_status_idx" ON "ReminderInstance"("organizationId", "scheduledFor", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderInstance_reminderRuleId_entityType_entityId_schedul_key" ON "ReminderInstance"("reminderRuleId", "entityType", "entityId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationCronDedup_dedupeKey_key" ON "NotificationCronDedup"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthChallenge_stateHash_key" ON "OAuthChallenge"("stateHash");

-- CreateIndex
CREATE INDEX "OAuthChallenge_expiresAt_idx" ON "OAuthChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "OAuthChallenge_organizationId_createdAt_idx" ON "OAuthChallenge"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "OcrExtraction_organizationId_idx" ON "OcrExtraction"("organizationId");

-- CreateIndex
CREATE INDEX "OcrExtraction_organizationId_documentId_idx" ON "OcrExtraction"("organizationId", "documentId");

-- CreateIndex
CREATE INDEX "OcrExtraction_organizationId_status_idx" ON "OcrExtraction"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_portalSubdomain_key" ON "Organization"("portalSubdomain");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_portalCustomDomain_key" ON "Organization"("portalCustomDomain");

-- CreateIndex
CREATE INDEX "Member_organizationId_idx" ON "Member"("organizationId");

-- CreateIndex
CREATE INDEX "Member_organizationId_userId_idx" ON "Member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Member_organizationId_role_idx" ON "Member"("organizationId", "role");

-- CreateIndex
CREATE INDEX "Member_organizationId_disabledAt_idx" ON "Member"("organizationId", "disabledAt");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");

-- CreateIndex
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");

-- CreateIndex
CREATE INDEX "Team_organizationId_status_idx" ON "Team"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- CreateIndex
CREATE INDEX "Project_organizationId_status_idx" ON "Project"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Project_organizationId_teamId_idx" ON "Project"("organizationId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_organizationId_code_key" ON "CostCenter"("organizationId", "code");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_nextAttemptAt_idx" ON "OutboxEvent"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_organizationId_createdAt_idx" ON "OutboxEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_organizationId_dedupKey_key" ON "OutboxEvent"("organizationId", "dedupKey");

-- CreateIndex
CREATE INDEX "PaymentRun_organizationId_idx" ON "PaymentRun"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentRun_organizationId_status_idx" ON "PaymentRun"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PaymentRun_organizationId_createdAt_idx" ON "PaymentRun"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRun_organizationId_runNumber_key" ON "PaymentRun"("organizationId", "runNumber");

-- CreateIndex
CREATE INDEX "PaymentRunItem_organizationId_idx" ON "PaymentRunItem"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentRunItem_organizationId_status_idx" ON "PaymentRunItem"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PaymentRunItem_organizationId_invoiceId_idx" ON "PaymentRunItem"("organizationId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRunItem_paymentRunId_invoiceId_key" ON "PaymentRunItem"("paymentRunId", "invoiceId");

-- CreateIndex
CREATE INDEX "PaymentExport_organizationId_idx" ON "PaymentExport"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentExport_organizationId_paymentRunId_idx" ON "PaymentExport"("organizationId", "paymentRunId");

-- CreateIndex
CREATE INDEX "PeppolParticipant_organizationId_idx" ON "PeppolParticipant"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PeppolParticipant_organizationId_participantId_key" ON "PeppolParticipant"("organizationId", "participantId");

-- CreateIndex
CREATE INDEX "PeppolTransmission_organizationId_idx" ON "PeppolTransmission"("organizationId");

-- CreateIndex
CREATE INDEX "PeppolTransmission_organizationId_status_idx" ON "PeppolTransmission"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PeppolTransmission_organizationId_invoiceId_idx" ON "PeppolTransmission"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "PeppolTransmission_aspTransmissionId_idx" ON "PeppolTransmission"("aspTransmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalSession_token_key" ON "PortalSession"("token");

-- CreateIndex
CREATE INDEX "PortalSession_token_idx" ON "PortalSession"("token");

-- CreateIndex
CREATE INDEX "PortalSession_email_idx" ON "PortalSession"("email");

-- CreateIndex
CREATE INDEX "PortalSession_contractorId_organizationId_idx" ON "PortalSession"("contractorId", "organizationId");

-- CreateIndex
CREATE INDEX "PortalSession_expiresAt_idx" ON "PortalSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalMagicToken_token_key" ON "PortalMagicToken"("token");

-- CreateIndex
CREATE INDEX "PortalMagicToken_token_idx" ON "PortalMagicToken"("token");

-- CreateIndex
CREATE INDEX "PortalMagicToken_email_idx" ON "PortalMagicToken"("email");

-- CreateIndex
CREATE INDEX "ContractorChangeRequest_organizationId_idx" ON "ContractorChangeRequest"("organizationId");

-- CreateIndex
CREATE INDEX "ContractorChangeRequest_organizationId_contractorId_status_idx" ON "ContractorChangeRequest"("organizationId", "contractorId", "status");

-- CreateIndex
CREATE INDEX "ContractorChangeRequest_organizationId_status_idx" ON "ContractorChangeRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ContractorNotificationPreference_organizationId_idx" ON "ContractorNotificationPreference"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorNotificationPreference_contractorId_category_key" ON "ContractorNotificationPreference"("contractorId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "PendingUpload_documentId_key" ON "PendingUpload"("documentId");

-- CreateIndex
CREATE INDEX "PendingUpload_organizationId_documentId_idx" ON "PendingUpload"("organizationId", "documentId");

-- CreateIndex
CREATE INDEX "PendingUpload_expiresAt_idx" ON "PendingUpload"("expiresAt");

-- CreateIndex
CREATE INDEX "TaxRate_countryCode_idx" ON "TaxRate"("countryCode");

-- CreateIndex
CREATE INDEX "TaxRate_countryCode_effectiveFrom_effectiveTo_idx" ON "TaxRate"("countryCode", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_countryCode_code_effectiveFrom_key" ON "TaxRate"("countryCode", "code", "effectiveFrom");

-- CreateIndex
CREATE INDEX "WithholdingTaxRate_sourceCountry_idx" ON "WithholdingTaxRate"("sourceCountry");

-- CreateIndex
CREATE INDEX "WithholdingTaxRate_sourceCountry_contractorResidency_idx" ON "WithholdingTaxRate"("sourceCountry", "contractorResidency");

-- CreateIndex
CREATE UNIQUE INDEX "WithholdingTaxRate_sourceCountry_contractorResidency_servic_key" ON "WithholdingTaxRate"("sourceCountry", "contractorResidency", "serviceType", "effectiveFrom");

-- CreateIndex
CREATE INDEX "WhtCertificate_organizationId_idx" ON "WhtCertificate"("organizationId");

-- CreateIndex
CREATE INDEX "WhtCertificate_organizationId_paymentRunItemId_idx" ON "WhtCertificate"("organizationId", "paymentRunItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WhtCertificate_organizationId_certificateNumber_key" ON "WhtCertificate"("organizationId", "certificateNumber");

-- CreateIndex
CREATE INDEX "TaxIdValidation_contractorId_taxIdType_requestedAt_idx" ON "TaxIdValidation"("contractorId", "taxIdType", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "TaxIdValidation_organizationId_requestedAt_idx" ON "TaxIdValidation"("organizationId", "requestedAt");

-- CreateIndex
CREATE INDEX "TaxIdValidation_organizationId_responseStatus_idx" ON "TaxIdValidation"("organizationId", "responseStatus");

-- CreateIndex
CREATE INDEX "Timesheet_organizationId_idx" ON "Timesheet"("organizationId");

-- CreateIndex
CREATE INDEX "Timesheet_organizationId_status_idx" ON "Timesheet"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Timesheet_organizationId_contractorId_idx" ON "Timesheet"("organizationId", "contractorId");

-- CreateIndex
CREATE INDEX "Timesheet_organizationId_contractorId_weekStartDate_idx" ON "Timesheet"("organizationId", "contractorId", "weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_organizationId_contractorId_weekStartDate_key" ON "Timesheet"("organizationId", "contractorId", "weekStartDate");

-- CreateIndex
CREATE INDEX "TimeEntry_organizationId_idx" ON "TimeEntry"("organizationId");

-- CreateIndex
CREATE INDEX "TimeEntry_organizationId_timesheetId_idx" ON "TimeEntry"("organizationId", "timesheetId");

-- CreateIndex
CREATE INDEX "TimeEntry_organizationId_contractorId_entryDate_idx" ON "TimeEntry"("organizationId", "contractorId", "entryDate");

-- CreateIndex
CREATE INDEX "TimeEntry_organizationId_contractId_entryDate_idx" ON "TimeEntry"("organizationId", "contractId", "entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_organizationId_contractorId_source_externalId_key" ON "TimeEntry"("organizationId", "contractorId", "source", "externalId");

-- CreateIndex
CREATE INDEX "WorkflowTemplate_organizationId_idx" ON "WorkflowTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "WorkflowTemplate_organizationId_type_status_idx" ON "WorkflowTemplate"("organizationId", "type", "status");

-- CreateIndex
CREATE INDEX "WorkflowTaskTemplate_organizationId_idx" ON "WorkflowTaskTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "WorkflowTaskTemplate_organizationId_workflowTemplateId_sort_idx" ON "WorkflowTaskTemplate"("organizationId", "workflowTemplateId", "sortOrder");

-- CreateIndex
CREATE INDEX "WorkflowRoleTemplate_organizationId_idx" ON "WorkflowRoleTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "WorkflowRoleTemplate_organizationId_isSeed_idx" ON "WorkflowRoleTemplate"("organizationId", "isSeed");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRoleTemplate_organizationId_role_key" ON "WorkflowRoleTemplate"("organizationId", "role");

-- CreateIndex
CREATE INDEX "WorkflowRoleTaskTemplate_organizationId_idx" ON "WorkflowRoleTaskTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "WorkflowRoleTaskTemplate_organizationId_workflowRoleTemplat_idx" ON "WorkflowRoleTaskTemplate"("organizationId", "workflowRoleTemplateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRoleTaskTemplate_workflowRoleTemplateId_sortOrder_key" ON "WorkflowRoleTaskTemplate"("workflowRoleTemplateId", "sortOrder");

-- CreateIndex
CREATE INDEX "WorkflowRun_organizationId_idx" ON "WorkflowRun"("organizationId");

-- CreateIndex
CREATE INDEX "WorkflowRun_organizationId_status_idx" ON "WorkflowRun"("organizationId", "status");

-- CreateIndex
CREATE INDEX "WorkflowRun_organizationId_contractorId_idx" ON "WorkflowRun"("organizationId", "contractorId");

-- CreateIndex
CREATE INDEX "WorkflowRun_organizationId_entityType_entityId_idx" ON "WorkflowRun"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "WorkflowRun_organizationId_dueAt_idx" ON "WorkflowRun"("organizationId", "dueAt");

-- CreateIndex
CREATE INDEX "WorkflowTaskRun_organizationId_idx" ON "WorkflowTaskRun"("organizationId");

-- CreateIndex
CREATE INDEX "WorkflowTaskRun_organizationId_workflowRunId_status_idx" ON "WorkflowTaskRun"("organizationId", "workflowRunId", "status");

-- CreateIndex
CREATE INDEX "WorkflowTaskRun_organizationId_assigneeUserId_status_idx" ON "WorkflowTaskRun"("organizationId", "assigneeUserId", "status");

-- CreateIndex
CREATE INDEX "WorkflowTaskRun_organizationId_dueAt_status_idx" ON "WorkflowTaskRun"("organizationId", "dueAt", "status");

-- CreateIndex
CREATE INDEX "WorkflowComment_organizationId_idx" ON "WorkflowComment"("organizationId");

-- CreateIndex
CREATE INDEX "WorkflowComment_organizationId_workflowRunId_idx" ON "WorkflowComment"("organizationId", "workflowRunId");

-- CreateIndex
CREATE INDEX "WorkflowAttachment_organizationId_idx" ON "WorkflowAttachment"("organizationId");

-- CreateIndex
CREATE INDEX "WorkflowAttachment_organizationId_workflowRunId_idx" ON "WorkflowAttachment"("organizationId", "workflowRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ZatcaInvoiceChain_invoiceId_key" ON "ZatcaInvoiceChain"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ZatcaInvoiceChain_zatcaUuid_key" ON "ZatcaInvoiceChain"("zatcaUuid");

-- CreateIndex
CREATE INDEX "ZatcaInvoiceChain_organizationId_idx" ON "ZatcaInvoiceChain"("organizationId");

-- CreateIndex
CREATE INDEX "ZatcaInvoiceChain_organizationId_zatcaStatus_idx" ON "ZatcaInvoiceChain"("organizationId", "zatcaStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ZatcaInvoiceChain_organizationId_icv_key" ON "ZatcaInvoiceChain"("organizationId", "icv");

-- AddForeignKey
ALTER TABLE "OrganizationApiKey" ADD CONSTRAINT "OrganizationApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationApiKey" ADD CONSTRAINT "OrganizationApiKey_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalChainConfig" ADD CONSTRAINT "ApprovalChainConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalFlow" ADD CONSTRAINT "ApprovalFlow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalFlow" ADD CONSTRAINT "ApprovalFlow_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approvalFlowId_fkey" FOREIGN KEY ("approvalFlowId") REFERENCES "ApprovalFlow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_approvalStepId_fkey" FOREIGN KEY ("approvalStepId") REFERENCES "ApprovalStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrCreditLedger" ADD CONSTRAINT "OcrCreditLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationAssessment" ADD CONSTRAINT "ClassificationAssessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationAssessment" ADD CONSTRAINT "ClassificationAssessment_contractorAssignmentId_fkey" FOREIGN KEY ("contractorAssignmentId") REFERENCES "ContractorAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationDocument" ADD CONSTRAINT "ClassificationDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationDocument" ADD CONSTRAINT "ClassificationDocument_classificationAssessmentId_fkey" FOREIGN KEY ("classificationAssessmentId") REFERENCES "ClassificationAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationDocument" ADD CONSTRAINT "ClassificationDocument_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ir35ChainParticipant" ADD CONSTRAINT "Ir35ChainParticipant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ir35ChainParticipant" ADD CONSTRAINT "Ir35ChainParticipant_contractorAssignmentId_fkey" FOREIGN KEY ("contractorAssignmentId") REFERENCES "ContractorAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ir35ChainParticipant" ADD CONSTRAINT "Ir35ChainParticipant_linkedOrganizationId_fkey" FOREIGN KEY ("linkedOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ir35ChainParticipant" ADD CONSTRAINT "Ir35ChainParticipant_linkedContractorId_fkey" FOREIGN KEY ("linkedContractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ir35OtherClientAttestation" ADD CONSTRAINT "Ir35OtherClientAttestation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ir35OtherClientAttestation" ADD CONSTRAINT "Ir35OtherClientAttestation_contractorAssignmentId_fkey" FOREIGN KEY ("contractorAssignmentId") REFERENCES "ContractorAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomicDependencyAlertState" ADD CONSTRAINT "EconomicDependencyAlertState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomicDependencyAlertState" ADD CONSTRAINT "EconomicDependencyAlertState_contractorAssignmentId_fkey" FOREIGN KEY ("contractorAssignmentId") REFERENCES "ContractorAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassessmentTrigger" ADD CONSTRAINT "ReassessmentTrigger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassessmentTrigger" ADD CONSTRAINT "ReassessmentTrigger_contractorAssignmentId_fkey" FOREIGN KEY ("contractorAssignmentId") REFERENCES "ContractorAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassessmentTrigger" ADD CONSTRAINT "ReassessmentTrigger_priorAssessmentId_fkey" FOREIGN KEY ("priorAssessmentId") REFERENCES "ClassificationAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassessmentTrigger" ADD CONSTRAINT "ReassessmentTrigger_priorSdsDocumentId_fkey" FOREIGN KEY ("priorSdsDocumentId") REFERENCES "ClassificationDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassessmentTrigger" ADD CONSTRAINT "ReassessmentTrigger_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassessmentTrigger" ADD CONSTRAINT "ReassessmentTrigger_dismissedByUserId_fkey" FOREIGN KEY ("dismissedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statusfeststellungsverfahren" ADD CONSTRAINT "Statusfeststellungsverfahren_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statusfeststellungsverfahren" ADD CONSTRAINT "Statusfeststellungsverfahren_contractorAssignmentId_fkey" FOREIGN KEY ("contractorAssignmentId") REFERENCES "ContractorAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationEscalationEvent" ADD CONSTRAINT "ClassificationEscalationEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationEscalationEvent" ADD CONSTRAINT "ClassificationEscalationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationEscalationEvent" ADD CONSTRAINT "ClassificationEscalationEvent_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ClassificationAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdsApproval" ADD CONSTRAINT "SdsApproval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdsApproval" ADD CONSTRAINT "SdsApproval_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ClassificationAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SdsApproval" ADD CONSTRAINT "SdsApproval_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyNotice" ADD CONSTRAINT "PrivacyNotice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_internalOwnerUserId_fkey" FOREIGN KEY ("internalOwnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAmendment" ADD CONSTRAINT "ContractAmendment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAmendment" ADD CONSTRAINT "ContractAmendment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRatePeriod" ADD CONSTRAINT "ContractRatePeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRatePeriod" ADD CONSTRAINT "ContractRatePeriod_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_primaryTeamId_fkey" FOREIGN KEY ("primaryTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_primaryProjectId_fkey" FOREIGN KEY ("primaryProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_defaultCostCenterId_fkey" FOREIGN KEY ("defaultCostCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_workflowRoleId_fkey" FOREIGN KEY ("workflowRoleId") REFERENCES "WorkflowRoleTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorContact" ADD CONSTRAINT "ContractorContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorContact" ADD CONSTRAINT "ContractorContact_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorBillingProfile" ADD CONSTRAINT "ContractorBillingProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorBillingProfile" ADD CONSTRAINT "ContractorBillingProfile_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorAssignment" ADD CONSTRAINT "ContractorAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorAssignment" ADD CONSTRAINT "ContractorAssignment_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorAssignment" ADD CONSTRAINT "ContractorAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorAssignment" ADD CONSTRAINT "ContractorAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorAssignment" ADD CONSTRAINT "ContractorAssignment_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorTag" ADD CONSTRAINT "ContractorTag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorTagLink" ADD CONSTRAINT "ContractorTagLink_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorTagLink" ADD CONSTRAINT "ContractorTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ContractorTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRequirementTemplate" ADD CONSTRAINT "ComplianceRequirementTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorComplianceItem" ADD CONSTRAINT "ContractorComplianceItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorComplianceItem" ADD CONSTRAINT "ContractorComplianceItem_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorComplianceItem" ADD CONSTRAINT "ContractorComplianceItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeitwegId" ADD CONSTRAINT "LeitwegId_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeitwegId" ADD CONSTRAINT "LeitwegId_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeitwegId" ADD CONSTRAINT "LeitwegId_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceLifecycle" ADD CONSTRAINT "EInvoiceLifecycle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceLifecycle" ADD CONSTRAINT "EInvoiceLifecycle_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceLifecycleEvent" ADD CONSTRAINT "EInvoiceLifecycleEvent_lifecycleId_fkey" FOREIGN KEY ("lifecycleId") REFERENCES "EInvoiceLifecycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceLifecycleEvent" ADD CONSTRAINT "EInvoiceLifecycleEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeppolCapabilityCache" ADD CONSTRAINT "PeppolCapabilityCache_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierConfig" ADD CONSTRAINT "CourierConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningEnvelope" ADD CONSTRAINT "SigningEnvelope_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningEnvelope" ADD CONSTRAINT "SigningEnvelope_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningRecipient" ADD CONSTRAINT "SigningRecipient_signingEnvelopeId_fkey" FOREIGN KEY ("signingEnvelopeId") REFERENCES "SigningEnvelope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningEvent" ADD CONSTRAINT "SigningEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningEvent" ADD CONSTRAINT "SigningEvent_signingEnvelopeId_fkey" FOREIGN KEY ("signingEnvelopeId") REFERENCES "SigningEnvelope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkontoTerm" ADD CONSTRAINT "SkontoTerm_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkontoTerm" ADD CONSTRAINT "SkontoTerm_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkontoTerm" ADD CONSTRAINT "SkontoTerm_billingProfileId_fkey" FOREIGN KEY ("billingProfileId") REFERENCES "ContractorBillingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkontoSnapshot" ADD CONSTRAINT "SkontoSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkontoSnapshot" ADD CONSTRAINT "SkontoSnapshot_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkontoSnapshot" ADD CONSTRAINT "SkontoSnapshot_skontoTermId_fkey" FOREIGN KEY ("skontoTermId") REFERENCES "SkontoTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkontoApplication" ADD CONSTRAINT "SkontoApplication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkontoApplication" ADD CONSTRAINT "SkontoApplication_paymentRunItemId_fkey" FOREIGN KEY ("paymentRunItemId") REFERENCES "PaymentRunItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkontoApplication" ADD CONSTRAINT "SkontoApplication_skontoTermId_fkey" FOREIGN KEY ("skontoTermId") REFERENCES "SkontoTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovApiAuditLog" ADD CONSTRAINT "GovApiAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalLink" ADD CONSTRAINT "ExternalLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalLink" ADD CONSTRAINT "ExternalLink_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncLog" ADD CONSTRAINT "IntegrationSyncLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncLog" ADD CONSTRAINT "IntegrationSyncLog_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billingProfileId_fkey" FOREIGN KEY ("billingProfileId") REFERENCES "ContractorBillingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceFile" ADD CONSTRAINT "InvoiceFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceFile" ADD CONSTRAINT "InvoiceFile_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceFile" ADD CONSTRAINT "InvoiceFile_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceMatchResult" ADD CONSTRAINT "InvoiceMatchResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceMatchResult" ADD CONSTRAINT "InvoiceMatchResult_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceIntakeRequest" ADD CONSTRAINT "InvoiceIntakeRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceIntakeRequest" ADD CONSTRAINT "InvoiceIntakeRequest_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceIntakeRequest" ADD CONSTRAINT "InvoiceIntakeRequest_matchedContractorId_fkey" FOREIGN KEY ("matchedContractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceIntakeRequest" ADD CONSTRAINT "InvoiceIntakeRequest_matchedContractId_fkey" FOREIGN KEY ("matchedContractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceIntakeRequest" ADD CONSTRAINT "InvoiceIntakeRequest_convertedInvoiceId_fkey" FOREIGN KEY ("convertedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceIntakeRequest" ADD CONSTRAINT "InvoiceIntakeRequest_validationAcknowledgedByUserId_fkey" FOREIGN KEY ("validationAcknowledgedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_sourcePaymentRunItemId_fkey" FOREIGN KEY ("sourcePaymentRunItemId") REFERENCES "PaymentRunItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceInterestCompensation" ADD CONSTRAINT "InvoiceInterestCompensation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceInterestCompensation" ADD CONSTRAINT "InvoiceInterestCompensation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceInterestWaiver" ADD CONSTRAINT "InvoiceInterestWaiver_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceInterestWaiver" ADD CONSTRAINT "InvoiceInterestWaiver_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceInterestClaim" ADD CONSTRAINT "InvoiceInterestClaim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceInterestClaim" ADD CONSTRAINT "InvoiceInterestClaim_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceInterestClaim" ADD CONSTRAINT "InvoiceInterestClaim_secondaryInvoiceId_fkey" FOREIGN KEY ("secondaryInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderInstance" ADD CONSTRAINT "ReminderInstance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthChallenge" ADD CONSTRAINT "OAuthChallenge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrExtraction" ADD CONSTRAINT "OcrExtraction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_fallbackApproverId_fkey" FOREIGN KEY ("fallbackApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRun" ADD CONSTRAINT "PaymentRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRun" ADD CONSTRAINT "PaymentRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRun" ADD CONSTRAINT "PaymentRun_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRunItem" ADD CONSTRAINT "PaymentRunItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRunItem" ADD CONSTRAINT "PaymentRunItem_paymentRunId_fkey" FOREIGN KEY ("paymentRunId") REFERENCES "PaymentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRunItem" ADD CONSTRAINT "PaymentRunItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRunItem" ADD CONSTRAINT "PaymentRunItem_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRunItem" ADD CONSTRAINT "PaymentRunItem_billingProfileId_fkey" FOREIGN KEY ("billingProfileId") REFERENCES "ContractorBillingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentExport" ADD CONSTRAINT "PaymentExport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentExport" ADD CONSTRAINT "PaymentExport_paymentRunId_fkey" FOREIGN KEY ("paymentRunId") REFERENCES "PaymentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentExport" ADD CONSTRAINT "PaymentExport_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentExport" ADD CONSTRAINT "PaymentExport_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeppolParticipant" ADD CONSTRAINT "PeppolParticipant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeppolTransmission" ADD CONSTRAINT "PeppolTransmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeppolTransmission" ADD CONSTRAINT "PeppolTransmission_peppolParticipantId_fkey" FOREIGN KEY ("peppolParticipantId") REFERENCES "PeppolParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorChangeRequest" ADD CONSTRAINT "ContractorChangeRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorChangeRequest" ADD CONSTRAINT "ContractorChangeRequest_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorChangeRequest" ADD CONSTRAINT "ContractorChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorNotificationPreference" ADD CONSTRAINT "ContractorNotificationPreference_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorNotificationPreference" ADD CONSTRAINT "ContractorNotificationPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingUpload" ADD CONSTRAINT "PendingUpload_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxIdValidation" ADD CONSTRAINT "TaxIdValidation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxIdValidation" ADD CONSTRAINT "TaxIdValidation_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTaskTemplate" ADD CONSTRAINT "WorkflowTaskTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTaskTemplate" ADD CONSTRAINT "WorkflowTaskTemplate_workflowTemplateId_fkey" FOREIGN KEY ("workflowTemplateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRoleTemplate" ADD CONSTRAINT "WorkflowRoleTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRoleTaskTemplate" ADD CONSTRAINT "WorkflowRoleTaskTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRoleTaskTemplate" ADD CONSTRAINT "WorkflowRoleTaskTemplate_workflowRoleTemplateId_fkey" FOREIGN KEY ("workflowRoleTemplateId") REFERENCES "WorkflowRoleTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowTemplateId_fkey" FOREIGN KEY ("workflowTemplateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTaskRun" ADD CONSTRAINT "WorkflowTaskRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTaskRun" ADD CONSTRAINT "WorkflowTaskRun_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTaskRun" ADD CONSTRAINT "WorkflowTaskRun_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTaskRun" ADD CONSTRAINT "WorkflowTaskRun_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowComment" ADD CONSTRAINT "WorkflowComment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowComment" ADD CONSTRAINT "WorkflowComment_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowComment" ADD CONSTRAINT "WorkflowComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAttachment" ADD CONSTRAINT "WorkflowAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAttachment" ADD CONSTRAINT "WorkflowAttachment_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAttachment" ADD CONSTRAINT "WorkflowAttachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZatcaInvoiceChain" ADD CONSTRAINT "ZatcaInvoiceChain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZatcaInvoiceChain" ADD CONSTRAINT "ZatcaInvoiceChain_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ==========================================================================
-- Custom SQL: Row Level Security (RLS)
-- ==========================================================================
-- Enable Row Level Security (RLS) tenant isolation for business tables.
-- Context is provided via Postgres session variables set per-transaction:
--   app.org_id, app.user_id

create schema if not exists app;

create or replace function app.current_org_id()
returns text
language sql
stable
as $$
  select current_setting('app.org_id', true)
$$;

create or replace function app.current_user_id()
returns text
language sql
stable
as $$
  select current_setting('app.user_id', true)
$$;

create or replace function app.is_org_member()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from "Member" m
    where m."organizationId" = app.current_org_id()
      and m."userId" = app.current_user_id()
  )
$$;

create or replace function app.has_role(allowed_roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from "Member" m
    where m."organizationId" = app.current_org_id()
      and m."userId" = app.current_user_id()
      and m."role" = any(allowed_roles)
  )
$$;

-- Role sets (based on packages/auth/src/roles.ts)
-- Read is any member; writes are split per domain.
create or replace function app.can_write_ops()
returns boolean
language sql
stable
as $$
  select app.has_role(array['admin','ops_manager'])
$$;

create or replace function app.can_write_finance()
returns boolean
language sql
stable
as $$
  select app.has_role(array['admin','finance_admin'])
$$;

create or replace function app.can_write_workflow()
returns boolean
language sql
stable
as $$
  select app.has_role(array['admin','ops_manager','team_manager'])
$$;

-- Helper: guard organizationId match
create or replace function app.org_match(row_org_id text)
returns boolean
language sql
stable
as $$
  select row_org_id = app.current_org_id()
$$;

-- =========================
-- Tenant-scoped app tables
-- =========================

-- Org-structure tables (exclude Better Auth org plugin tables: "Organization","Member","Invitation")
alter table "Team" enable row level security;
alter table "Team" force row level security;
drop policy if exists team_select on "Team";
create policy team_select on "Team"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists team_write on "Team";
create policy team_write on "Team"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "Project" enable row level security;
alter table "Project" force row level security;
drop policy if exists project_select on "Project";
create policy project_select on "Project"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists project_write on "Project";
create policy project_write on "Project"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "CostCenter" enable row level security;
alter table "CostCenter" force row level security;
drop policy if exists costcenter_select on "CostCenter";
create policy costcenter_select on "CostCenter"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists costcenter_write on "CostCenter";
create policy costcenter_write on "CostCenter"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- Contractor domain
alter table "Contractor" enable row level security;
alter table "Contractor" force row level security;
drop policy if exists contractor_select on "Contractor";
create policy contractor_select on "Contractor"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractor_write on "Contractor";
create policy contractor_write on "Contractor"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractorContact" enable row level security;
alter table "ContractorContact" force row level security;
drop policy if exists contractorcontact_select on "ContractorContact";
create policy contractorcontact_select on "ContractorContact"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractorcontact_write on "ContractorContact";
create policy contractorcontact_write on "ContractorContact"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractorBillingProfile" enable row level security;
alter table "ContractorBillingProfile" force row level security;
drop policy if exists contractorbillingprofile_select on "ContractorBillingProfile";
create policy contractorbillingprofile_select on "ContractorBillingProfile"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractorbillingprofile_write on "ContractorBillingProfile";
create policy contractorbillingprofile_write on "ContractorBillingProfile"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractorAssignment" enable row level security;
alter table "ContractorAssignment" force row level security;
drop policy if exists contractorassignment_select on "ContractorAssignment";
create policy contractorassignment_select on "ContractorAssignment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractorassignment_write on "ContractorAssignment";
create policy contractorassignment_write on "ContractorAssignment"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractorTag" enable row level security;
alter table "ContractorTag" force row level security;
drop policy if exists contractortag_select on "ContractorTag";
create policy contractortag_select on "ContractorTag"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractortag_write on "ContractorTag";
create policy contractortag_write on "ContractorTag"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- Join table without organizationId: enforce via parents.
alter table "ContractorTagLink" enable row level security;
alter table "ContractorTagLink" force row level security;
drop policy if exists contractortaglink_select on "ContractorTagLink";
create policy contractortaglink_select on "ContractorTagLink"
  for select
  using (
    app.is_org_member()
    and exists (
      select 1
      from "Contractor" c
      where c."id" = "ContractorTagLink"."contractorId"
        and c."organizationId" = app.current_org_id()
    )
    and exists (
      select 1
      from "ContractorTag" t
      where t."id" = "ContractorTagLink"."tagId"
        and t."organizationId" = app.current_org_id()
    )
  );
drop policy if exists contractortaglink_write on "ContractorTagLink";
create policy contractortaglink_write on "ContractorTagLink"
  for all
  using (
    app.can_write_ops()
    and exists (
      select 1
      from "Contractor" c
      where c."id" = "ContractorTagLink"."contractorId"
        and c."organizationId" = app.current_org_id()
    )
    and exists (
      select 1
      from "ContractorTag" t
      where t."id" = "ContractorTagLink"."tagId"
        and t."organizationId" = app.current_org_id()
    )
  )
  with check (
    app.can_write_ops()
    and exists (
      select 1
      from "Contractor" c
      where c."id" = "ContractorTagLink"."contractorId"
        and c."organizationId" = app.current_org_id()
    )
    and exists (
      select 1
      from "ContractorTag" t
      where t."id" = "ContractorTagLink"."tagId"
        and t."organizationId" = app.current_org_id()
    )
  );

alter table "ComplianceRequirementTemplate" enable row level security;
alter table "ComplianceRequirementTemplate" force row level security;
drop policy if exists compliancerequirementtemplate_select on "ComplianceRequirementTemplate";
create policy compliancerequirementtemplate_select on "ComplianceRequirementTemplate"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists compliancerequirementtemplate_write on "ComplianceRequirementTemplate";
create policy compliancerequirementtemplate_write on "ComplianceRequirementTemplate"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractorComplianceItem" enable row level security;
alter table "ContractorComplianceItem" force row level security;
drop policy if exists contractorcomplianceitem_select on "ContractorComplianceItem";
create policy contractorcomplianceitem_select on "ContractorComplianceItem"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractorcomplianceitem_write on "ContractorComplianceItem";
create policy contractorcomplianceitem_write on "ContractorComplianceItem"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- Contract + documents
alter table "Contract" enable row level security;
alter table "Contract" force row level security;
drop policy if exists contract_select on "Contract";
create policy contract_select on "Contract"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contract_write on "Contract";
create policy contract_write on "Contract"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractAmendment" enable row level security;
alter table "ContractAmendment" force row level security;
drop policy if exists contractamendment_select on "ContractAmendment";
create policy contractamendment_select on "ContractAmendment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractamendment_write on "ContractAmendment";
create policy contractamendment_write on "ContractAmendment"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractRatePeriod" enable row level security;
alter table "ContractRatePeriod" force row level security;
drop policy if exists contractrateperiod_select on "ContractRatePeriod";
create policy contractrateperiod_select on "ContractRatePeriod"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractrateperiod_write on "ContractRatePeriod";
create policy contractrateperiod_write on "ContractRatePeriod"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "Document" enable row level security;
alter table "Document" force row level security;
drop policy if exists document_select on "Document";
create policy document_select on "Document"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists document_write on "Document";
create policy document_write on "Document"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "DocumentLink" enable row level security;
alter table "DocumentLink" force row level security;
drop policy if exists documentlink_select on "DocumentLink";
create policy documentlink_select on "DocumentLink"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists documentlink_write on "DocumentLink";
create policy documentlink_write on "DocumentLink"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- Invoice + payment (finance write)
alter table "Invoice" enable row level security;
alter table "Invoice" force row level security;
drop policy if exists invoice_select on "Invoice";
create policy invoice_select on "Invoice"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists invoice_write on "Invoice";
create policy invoice_write on "Invoice"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "InvoiceFile" enable row level security;
alter table "InvoiceFile" force row level security;
drop policy if exists invoicefile_select on "InvoiceFile";
create policy invoicefile_select on "InvoiceFile"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists invoicefile_write on "InvoiceFile";
create policy invoicefile_write on "InvoiceFile"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "InvoiceLine" enable row level security;
alter table "InvoiceLine" force row level security;
drop policy if exists invoiceline_select on "InvoiceLine";
create policy invoiceline_select on "InvoiceLine"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists invoiceline_write on "InvoiceLine";
create policy invoiceline_write on "InvoiceLine"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "InvoiceMatchResult" enable row level security;
alter table "InvoiceMatchResult" force row level security;
drop policy if exists invoicematchresult_select on "InvoiceMatchResult";
create policy invoicematchresult_select on "InvoiceMatchResult"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists invoicematchresult_write on "InvoiceMatchResult";
create policy invoicematchresult_write on "InvoiceMatchResult"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "PaymentRun" enable row level security;
alter table "PaymentRun" force row level security;
drop policy if exists paymentrun_select on "PaymentRun";
create policy paymentrun_select on "PaymentRun"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists paymentrun_write on "PaymentRun";
create policy paymentrun_write on "PaymentRun"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "PaymentRunItem" enable row level security;
alter table "PaymentRunItem" force row level security;
drop policy if exists paymentrunitem_select on "PaymentRunItem";
create policy paymentrunitem_select on "PaymentRunItem"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists paymentrunitem_write on "PaymentRunItem";
create policy paymentrunitem_write on "PaymentRunItem"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "PaymentExport" enable row level security;
alter table "PaymentExport" force row level security;
drop policy if exists paymentexport_select on "PaymentExport";
create policy paymentexport_select on "PaymentExport"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists paymentexport_write on "PaymentExport";
create policy paymentexport_write on "PaymentExport"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

-- Workflow (workflow write)
alter table "WorkflowTemplate" enable row level security;
alter table "WorkflowTemplate" force row level security;
drop policy if exists workflowtemplate_select on "WorkflowTemplate";
create policy workflowtemplate_select on "WorkflowTemplate"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists workflowtemplate_write on "WorkflowTemplate";
create policy workflowtemplate_write on "WorkflowTemplate"
  for all
  using (app.org_match("organizationId") and app.can_write_workflow())
  with check (app.org_match("organizationId") and app.can_write_workflow());

alter table "WorkflowTaskTemplate" enable row level security;
alter table "WorkflowTaskTemplate" force row level security;
drop policy if exists workflowtasktemplate_select on "WorkflowTaskTemplate";
create policy workflowtasktemplate_select on "WorkflowTaskTemplate"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists workflowtasktemplate_write on "WorkflowTaskTemplate";
create policy workflowtasktemplate_write on "WorkflowTaskTemplate"
  for all
  using (app.org_match("organizationId") and app.can_write_workflow())
  with check (app.org_match("organizationId") and app.can_write_workflow());

alter table "WorkflowRun" enable row level security;
alter table "WorkflowRun" force row level security;
drop policy if exists workflowrun_select on "WorkflowRun";
create policy workflowrun_select on "WorkflowRun"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists workflowrun_write on "WorkflowRun";
create policy workflowrun_write on "WorkflowRun"
  for all
  using (app.org_match("organizationId") and app.can_write_workflow())
  with check (app.org_match("organizationId") and app.can_write_workflow());

alter table "WorkflowTaskRun" enable row level security;
alter table "WorkflowTaskRun" force row level security;
drop policy if exists workflowtaskrun_select on "WorkflowTaskRun";
create policy workflowtaskrun_select on "WorkflowTaskRun"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists workflowtaskrun_write on "WorkflowTaskRun";
create policy workflowtaskrun_write on "WorkflowTaskRun"
  for all
  using (app.org_match("organizationId") and app.can_write_workflow())
  with check (app.org_match("organizationId") and app.can_write_workflow());

alter table "WorkflowComment" enable row level security;
alter table "WorkflowComment" force row level security;
drop policy if exists workflowcomment_select on "WorkflowComment";
create policy workflowcomment_select on "WorkflowComment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists workflowcomment_write on "WorkflowComment";
create policy workflowcomment_write on "WorkflowComment"
  for all
  using (app.org_match("organizationId") and app.can_write_workflow())
  with check (app.org_match("organizationId") and app.can_write_workflow());

alter table "WorkflowAttachment" enable row level security;
alter table "WorkflowAttachment" force row level security;
drop policy if exists workflowattachment_select on "WorkflowAttachment";
create policy workflowattachment_select on "WorkflowAttachment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists workflowattachment_write on "WorkflowAttachment";
create policy workflowattachment_write on "WorkflowAttachment"
  for all
  using (app.org_match("organizationId") and app.can_write_workflow())
  with check (app.org_match("organizationId") and app.can_write_workflow());

-- Approval (treat as finance write)
alter table "ApprovalChainConfig" enable row level security;
alter table "ApprovalChainConfig" force row level security;
drop policy if exists approvalchainconfig_select on "ApprovalChainConfig";
create policy approvalchainconfig_select on "ApprovalChainConfig"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists approvalchainconfig_write on "ApprovalChainConfig";
create policy approvalchainconfig_write on "ApprovalChainConfig"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "ApprovalFlow" enable row level security;
alter table "ApprovalFlow" force row level security;
drop policy if exists approvalflow_select on "ApprovalFlow";
create policy approvalflow_select on "ApprovalFlow"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists approvalflow_write on "ApprovalFlow";
create policy approvalflow_write on "ApprovalFlow"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "ApprovalStep" enable row level security;
alter table "ApprovalStep" force row level security;
drop policy if exists approvalstep_select on "ApprovalStep";
create policy approvalstep_select on "ApprovalStep"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists approvalstep_write on "ApprovalStep";
create policy approvalstep_write on "ApprovalStep"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "ApprovalDecision" enable row level security;
alter table "ApprovalDecision" force row level security;
drop policy if exists approvaldecision_select on "ApprovalDecision";
create policy approvaldecision_select on "ApprovalDecision"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists approvaldecision_write on "ApprovalDecision";
create policy approvaldecision_write on "ApprovalDecision"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

-- Integration (ops write)
alter table "IntegrationConnection" enable row level security;
alter table "IntegrationConnection" force row level security;
drop policy if exists integrationconnection_select on "IntegrationConnection";
create policy integrationconnection_select on "IntegrationConnection"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists integrationconnection_write on "IntegrationConnection";
create policy integrationconnection_write on "IntegrationConnection"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ExternalLink" enable row level security;
alter table "ExternalLink" force row level security;
drop policy if exists externallink_select on "ExternalLink";
create policy externallink_select on "ExternalLink"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists externallink_write on "ExternalLink";
create policy externallink_write on "ExternalLink"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "IntegrationSyncLog" enable row level security;
alter table "IntegrationSyncLog" force row level security;
drop policy if exists integrationsynclog_select on "IntegrationSyncLog";
create policy integrationsynclog_select on "IntegrationSyncLog"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists integrationsynclog_write on "IntegrationSyncLog";
create policy integrationsynclog_write on "IntegrationSyncLog"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "WebhookDelivery" enable row level security;
alter table "WebhookDelivery" force row level security;
drop policy if exists webhookdelivery_select on "WebhookDelivery";
create policy webhookdelivery_select on "WebhookDelivery"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists webhookdelivery_write on "WebhookDelivery";
create policy webhookdelivery_write on "WebhookDelivery"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- Notifications / comments / reminders (member read; ops write)
alter table "Notification" enable row level security;
alter table "Notification" force row level security;
drop policy if exists notification_select on "Notification";
create policy notification_select on "Notification"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists notification_write on "Notification";
create policy notification_write on "Notification"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "UserNotificationPreference" enable row level security;
alter table "UserNotificationPreference" force row level security;
drop policy if exists usernotificationpreference_select on "UserNotificationPreference";
create policy usernotificationpreference_select on "UserNotificationPreference"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists usernotificationpreference_write on "UserNotificationPreference";
create policy usernotificationpreference_write on "UserNotificationPreference"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "Comment" enable row level security;
alter table "Comment" force row level security;
drop policy if exists comment_select on "Comment";
create policy comment_select on "Comment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists comment_write on "Comment";
create policy comment_write on "Comment"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ReminderRule" enable row level security;
alter table "ReminderRule" force row level security;
drop policy if exists reminderrule_select on "ReminderRule";
create policy reminderrule_select on "ReminderRule"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists reminderrule_write on "ReminderRule";
create policy reminderrule_write on "ReminderRule"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ReminderInstance" enable row level security;
alter table "ReminderInstance" force row level security;
drop policy if exists reminderinstance_select on "ReminderInstance";
create policy reminderinstance_select on "ReminderInstance"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists reminderinstance_write on "ReminderInstance";
create policy reminderinstance_write on "ReminderInstance"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- Audit/outbox (ops write)
alter table "AuditLog" enable row level security;
alter table "AuditLog" force row level security;
drop policy if exists auditlog_select on "AuditLog";
create policy auditlog_select on "AuditLog"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists auditlog_write on "AuditLog";
create policy auditlog_write on "AuditLog"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "OutboxEvent" enable row level security;
alter table "OutboxEvent" force row level security;
drop policy if exists outboxevent_select on "OutboxEvent";
create policy outboxevent_select on "OutboxEvent"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists outboxevent_write on "OutboxEvent";
create policy outboxevent_write on "OutboxEvent"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());


-- Extended RLS coverage
-- Extend Row Level Security coverage to all remaining tenant-scoped tables.
-- Follows the same pattern as 20260318120000_enable_rls:
--   - SELECT: org membership check
--   - Write: role-based check per domain

-- =========================
-- Equipment domain (ops write)
-- =========================

alter table "Equipment" enable row level security;
alter table "Equipment" force row level security;
drop policy if exists equipment_select on "Equipment";
create policy equipment_select on "Equipment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists equipment_write on "Equipment";
create policy equipment_write on "Equipment"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "EquipmentAssignment" enable row level security;
alter table "EquipmentAssignment" force row level security;
drop policy if exists equipmentassignment_select on "EquipmentAssignment";
create policy equipmentassignment_select on "EquipmentAssignment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists equipmentassignment_write on "EquipmentAssignment";
create policy equipmentassignment_write on "EquipmentAssignment"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "Shipment" enable row level security;
alter table "Shipment" force row level security;
drop policy if exists shipment_select on "Shipment";
create policy shipment_select on "Shipment"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists shipment_write on "Shipment";
create policy shipment_write on "Shipment"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ShipmentEvent" enable row level security;
alter table "ShipmentEvent" force row level security;
drop policy if exists shipmentevent_select on "ShipmentEvent";
create policy shipmentevent_select on "ShipmentEvent"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists shipmentevent_write on "ShipmentEvent";
create policy shipmentevent_write on "ShipmentEvent"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ReturnRequest" enable row level security;
alter table "ReturnRequest" force row level security;
drop policy if exists returnrequest_select on "ReturnRequest";
create policy returnrequest_select on "ReturnRequest"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists returnrequest_write on "ReturnRequest";
create policy returnrequest_write on "ReturnRequest"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "CourierConfig" enable row level security;
alter table "CourierConfig" force row level security;
drop policy if exists courierconfig_select on "CourierConfig";
create policy courierconfig_select on "CourierConfig"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists courierconfig_write on "CourierConfig";
create policy courierconfig_write on "CourierConfig"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- =========================
-- E-signature domain (ops write)
-- =========================

alter table "SigningEnvelope" enable row level security;
alter table "SigningEnvelope" force row level security;
drop policy if exists signingenvelope_select on "SigningEnvelope";
create policy signingenvelope_select on "SigningEnvelope"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists signingenvelope_write on "SigningEnvelope";
create policy signingenvelope_write on "SigningEnvelope"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "SigningEvent" enable row level security;
alter table "SigningEvent" force row level security;
drop policy if exists signingevent_select on "SigningEvent";
create policy signingevent_select on "SigningEvent"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists signingevent_write on "SigningEvent";
create policy signingevent_write on "SigningEvent"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- SigningRecipient has no organizationId — enforce via parent envelope.
alter table "SigningRecipient" enable row level security;
alter table "SigningRecipient" force row level security;
drop policy if exists signingrecipient_select on "SigningRecipient";
create policy signingrecipient_select on "SigningRecipient"
  for select
  using (
    app.is_org_member()
    and exists (
      select 1
      from "SigningEnvelope" e
      where e."id" = "SigningRecipient"."signingEnvelopeId"
        and e."organizationId" = app.current_org_id()
    )
  );
drop policy if exists signingrecipient_write on "SigningRecipient";
create policy signingrecipient_write on "SigningRecipient"
  for all
  using (
    app.can_write_ops()
    and exists (
      select 1
      from "SigningEnvelope" e
      where e."id" = "SigningRecipient"."signingEnvelopeId"
        and e."organizationId" = app.current_org_id()
    )
  )
  with check (
    app.can_write_ops()
    and exists (
      select 1
      from "SigningEnvelope" e
      where e."id" = "SigningRecipient"."signingEnvelopeId"
        and e."organizationId" = app.current_org_id()
    )
  );

-- =========================
-- Time-tracking domain (ops write)
-- =========================

alter table "Timesheet" enable row level security;
alter table "Timesheet" force row level security;
drop policy if exists timesheet_select on "Timesheet";
create policy timesheet_select on "Timesheet"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists timesheet_write on "Timesheet";
create policy timesheet_write on "Timesheet"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "TimeEntry" enable row level security;
alter table "TimeEntry" force row level security;
drop policy if exists timeentry_select on "TimeEntry";
create policy timeentry_select on "TimeEntry"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists timeentry_write on "TimeEntry";
create policy timeentry_write on "TimeEntry"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- =========================
-- OCR domain (ops write)
-- =========================

alter table "OcrExtraction" enable row level security;
alter table "OcrExtraction" force row level security;
drop policy if exists ocrextraction_select on "OcrExtraction";
create policy ocrextraction_select on "OcrExtraction"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists ocrextraction_write on "OcrExtraction";
create policy ocrextraction_write on "OcrExtraction"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- =========================
-- Billing domain (finance write)
-- =========================

alter table "OcrCreditLedger" enable row level security;
alter table "OcrCreditLedger" force row level security;
drop policy if exists ocrcreditledger_select on "OcrCreditLedger";
create policy ocrcreditledger_select on "OcrCreditLedger"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists ocrcreditledger_write on "OcrCreditLedger";
create policy ocrcreditledger_write on "OcrCreditLedger"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

alter table "Subscription" enable row level security;
alter table "Subscription" force row level security;
drop policy if exists subscription_select on "Subscription";
create policy subscription_select on "Subscription"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists subscription_write on "Subscription";
create policy subscription_write on "Subscription"
  for all
  using (app.org_match("organizationId") and app.can_write_finance())
  with check (app.org_match("organizationId") and app.can_write_finance());

-- =========================
-- Portal domain (ops write)
-- =========================

alter table "PortalSession" enable row level security;
alter table "PortalSession" force row level security;
drop policy if exists portalsession_select on "PortalSession";
create policy portalsession_select on "PortalSession"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists portalsession_write on "PortalSession";
create policy portalsession_write on "PortalSession"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractorChangeRequest" enable row level security;
alter table "ContractorChangeRequest" force row level security;
drop policy if exists contractorchangerequest_select on "ContractorChangeRequest";
create policy contractorchangerequest_select on "ContractorChangeRequest"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractorchangerequest_write on "ContractorChangeRequest";
create policy contractorchangerequest_write on "ContractorChangeRequest"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

alter table "ContractorNotificationPreference" enable row level security;
alter table "ContractorNotificationPreference" force row level security;
drop policy if exists contractornotificationpreference_select on "ContractorNotificationPreference";
create policy contractornotificationpreference_select on "ContractorNotificationPreference"
  for select
  using (app.org_match("organizationId") and app.is_org_member());
drop policy if exists contractornotificationpreference_write on "ContractorNotificationPreference";
create policy contractornotificationpreference_write on "ContractorNotificationPreference"
  for all
  using (app.org_match("organizationId") and app.can_write_ops())
  with check (app.org_match("organizationId") and app.can_write_ops());

-- ==========================================================================
-- Custom SQL: Full-text search generated columns + GIN indexes
-- ==========================================================================
-- Add generated tsvector column for full-text search
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("legalName", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("displayName", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("taxId", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("email", '')), 'B')
  ) STORED;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "Contractor_search_vector_idx" ON "Contractor" USING GIN ("search_vector");

-- Add generated tsvector column for full-text search on contracts
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("contractNumber", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("notes", '')), 'C')
  ) STORED;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "contract_fts_idx" ON "Contract" USING GIN ("searchVector");

-- Add generated tsvector column for full-text search on invoices
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("invoiceNumber", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("notes", '')), 'B')
  ) STORED;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "Invoice_search_vector_idx" ON "Invoice" USING GIN ("search_vector");

-- ==========================================================================
-- Custom SQL: Unique constraints / partial indexes
-- ==========================================================================

-- PaymentRun.runNumber uniqueness per org
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRun_organizationId_runNumber_key"
  ON "PaymentRun" ("organizationId", "runNumber");

-- Invoice.invoiceNumber per (org, contractor)
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_organizationId_contractorId_invoiceNumber_key"
  ON "Invoice" ("organizationId", "contractorId", "invoiceNumber");

-- Active invoice guard: prevent same invoice in multiple active payment run items
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRunItem_active_invoice_once_idx"
  ON "PaymentRunItem" ("organizationId", "invoiceId")
  WHERE "status" IN ('PENDING', 'EXPORTED');

-- Cron idempotency: at most one ReminderInstance per rule + entity + scheduled day
CREATE UNIQUE INDEX IF NOT EXISTS "ReminderInstance_reminderRuleId_entityType_entityId_scheduledFor_key"
  ON "ReminderInstance" ("reminderRuleId", "entityType", "entityId", "scheduledFor");
