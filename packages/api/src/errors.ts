/**
 * Standardized error message keys for API responses.
 *
 * These keys are sent as TRPCError `message` values and translated
 * on the frontend via the `Errors` i18n namespace.
 *
 * Convention: SCREAMING_SNAKE_CASE so the frontend can detect them
 * via regex and look up translations automatically.
 */

import * as ApiErrors from './errors.js';

/**
 * Set of all camelCase error values exported from this module. Built lazily on
 * first call so adding a new constant requires no manual registration. Used by
 * `init.ts` `errorFormatter` to decide whether a `TRPCError.message` should be
 * surfaced verbatim as `shape.data.errorKey` or replaced with `'unknownError'`.
 */
let knownValues: Set<string> | undefined;

function buildKnownValues(): Set<string> {
  const set = new Set<string>();
  // Self-import: this read is lazy (called from `isKnownApiErrorValue`, never
  // during module evaluation), so the namespace object is fully populated by
  // the time the loop runs.
  for (const [, value] of Object.entries(ApiErrors as Record<string, unknown>)) {
    if (typeof value === 'string') set.add(value);
  }
  return set;
}

export function isKnownApiErrorValue(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!knownValues) knownValues = buildKnownValues();
  return knownValues.has(value);
}

// ─── Generic ─────────────────────────────────────────────────────
export const UNAUTHORIZED = 'unauthorized';
export const FORBIDDEN = 'forbidden';
export const ACCOUNT_BANNED = 'accountBanned';
export const LAST_ADMIN_CANNOT_DEACTIVATE = 'lastAdminCannotDeactivate';
export const PERMISSION_DENIED = 'permissionDenied';
export const UNKNOWN_ERROR = 'unknownError';
export const PLATFORM_ADMIN_REQUIRED = 'platformAdminRequired';
export const SERVER_MISCONFIGURED = 'serverMisconfigured';

// ─── Org definitions (projects / teams / cost centers) ───────────
export const PROJECT_NOT_FOUND = 'projectNotFound';
export const PENDING_MERGE_NOT_FOUND = 'pendingMergeNotFound';
export const TEAM_NOT_FOUND = 'teamNotFound';
export const COST_CENTER_NOT_FOUND = 'costCenterNotFound';
export const ORG_NO_COUNTRY = 'orgNoCountry';

// ─── Contractor ──────────────────────────────────────────────────
export const CONTRACTOR_NOT_FOUND = 'contractorNotFound';
export const CONTRACTOR_HAS_UNPAID_INVOICES = 'contractorHasUnpaidInvoices';
export const CONTRACTOR_HAS_ACTIVE_WORKFLOWS = 'contractorHasActiveWorkflows';
export const CONTRACTOR_HAS_ACTIVE_CONTRACTS = 'contractorHasActiveContracts';
export const CONTRACTOR_INVALID_TRANSITION = 'contractorInvalidTransition';
export const COMPANY_LOOKUP_FAILED = 'companyLookupFailed';

// ─── Contract ────────────────────────────────────────────────────
export const CONTRACT_NOT_FOUND = 'contractNotFound';
export const CONTRACT_END_DATE_BEFORE_START = 'contractEndDateBeforeStart';
export const CONTRACT_INVALID_TRANSITION = 'contractInvalidTransition';

// ─── Invoice ─────────────────────────────────────────────────────
export const INVOICE_AMOUNT_MISMATCH = 'invoiceAmountMismatch';
export const INVOICE_NOT_FOUND = 'invoiceNotFound';
export const INVOICE_NOT_RECEIVED_STATUS = 'invoiceNotReceivedStatus';
export const INVOICE_CONTRACTOR_NOT_FOUND = 'invoiceContractorNotFound';
export const INVOICE_CONTRACT_NOT_FOUND = 'invoiceContractNotFound';
export const INVOICE_ALREADY_PENDING = 'invoiceAlreadyPending';
export const INVOICE_DUPLICATE = 'invoiceDuplicate';
export const INVOICE_ALREADY_VOIDED = 'invoiceAlreadyVoided';
export const INVOICE_VOID_NOT_ALLOWED = 'invoiceVoidNotAllowed';

// ─── Payment ─────────────────────────────────────────────────────
export const PAYMENT_RUN_NOT_FOUND = 'paymentRunNotFound';
export const PAYMENT_INVOICES_NOT_READY = 'paymentInvoicesNotReady';
export const PAYMENT_INVOICES_NOT_FOUND = 'paymentInvoicesNotFound';
export const PAYMENT_RUN_INVALID_STATUS = 'paymentRunInvalidStatus';
export const PAYMENT_RUN_ITEM_NOT_FOUND = 'paymentRunItemNotFound';
export const PAYMENT_RUN_NOT_DRAFT = 'paymentRunNotDraft';
export const PAYMENT_INVOICE_NOT_IN_RUN = 'paymentInvoiceNotInRun';
export const PAYMENT_MIXED_CURRENCIES = 'paymentMixedCurrencies';

// ─── Approval ────────────────────────────────────────────────────
export const APPROVAL_CHAIN_NOT_FOUND = 'approvalChainNotFound';
export const APPROVAL_CHAIN_HAS_ACTIVE_FLOWS = 'approvalChainHasActiveFlows';
export const APPROVAL_STEP_NOT_FOUND = 'approvalStepNotFound';
export const APPROVAL_STEP_NOT_PENDING = 'approvalStepNotPending';
export const APPROVAL_NOT_ASSIGNED = 'approvalNotAssigned';
export const APPROVAL_DELEGATE_NOT_MEMBER = 'approvalDelegateNotMember';
export const APPROVAL_SELF_APPROVAL_FORBIDDEN = 'approvalSelfApprovalForbidden';

// ─── Workflow ────────────────────────────────────────────────────
export const WORKFLOW_TEMPLATE_NOT_FOUND = 'workflowTemplateNotFound';
export const WORKFLOW_RUN_NOT_FOUND = 'workflowRunNotFound';
export const WORKFLOW_RUN_ALREADY_CANCELLED = 'workflowRunAlreadyCancelled';
export const WORKFLOW_TASK_NOT_FOUND = 'workflowTaskNotFound';
export const WORKFLOW_TASK_INVALID_STATUS = 'workflowTaskInvalidStatus';
export const WORKFLOW_TASK_CANNOT_SKIP = 'workflowTaskCannotSkip';

// ─── Document ────────────────────────────────────────────────────
export const DOCUMENT_NOT_FOUND = 'documentNotFound';
export const DOCUMENT_FILE_TYPE_NOT_ALLOWED = 'documentFileTypeNotAllowed';
export const DOCUMENT_NOT_IN_STORAGE = 'documentNotInStorage';
export const DOCUMENT_INFECTED = 'documentInfected';
export const DOCUMENT_NOT_ACTIVE = 'documentNotActive';
// F-SEC-19 — per-content-type byte cap exceeded.
export const DOCUMENT_FILE_TOO_LARGE = 'documentFileTooLarge';
// F-SEC-18 — sniffed MIME type does not match the declared mimeType.
export const DOCUMENT_MIME_MISMATCH = 'documentMimeMismatch';

// ─── Import ──────────────────────────────────────────────────────
export const IMPORT_NO_DATA_ROWS = 'importNoDataRows';

// ─── Portal ──────────────────────────────────────────────────────
export const PORTAL_INVALID_LINK = 'portalInvalidLink';
export const PORTAL_INVALID_VERIFICATION = 'portalInvalidVerification';
export const PORTAL_CONTRACT_NOT_FOUND = 'portalContractNotFound';
export const PORTAL_NO_CHANGES = 'portalNoChanges';
export const PORTAL_SECURITY_ALERTS_LOCKED = 'portalSecurityAlertsLocked';
export const PORTAL_PENDING_CHANGE_EXISTS = 'portalPendingChangeExists';
export const PORTAL_CHANGE_REQUEST_NOT_FOUND = 'portalChangeRequestNotFound';
export const PORTAL_BILLING_PROFILE_NOT_FOUND = 'portalBillingProfileNotFound';

// ─── Integration ─────────────────────────────────────────────────
export const INTEGRATION_NOT_FOUND = 'integrationNotFound';
export const INTEGRATION_NOT_CONNECTED = 'integrationNotConnected';
export const INTEGRATION_LINK_NOT_FOUND = 'integrationLinkNotFound';
export const INTEGRATION_NO_OAUTH = 'integrationNoOauth';
export const INTEGRATION_NOT_CONFIGURED = 'integrationNotConfigured';

// ─── Reminder ────────────────────────────────────────────────────
export const REMINDER_RULE_NOT_FOUND = 'reminderRuleNotFound';

// ─── Settings ────────────────────────────────────────────────────
export const SETTINGS_SUBDOMAIN_TAKEN = 'settingsSubdomainTaken';

// ─── E-Sign ──────────────────────────────────────────────────────
export const ESIGN_DOCUMENT_NOT_FOUND = 'esignDocumentNotFound';
export const ESIGN_DOWNLOAD_FAILED = 'esignDownloadFailed';
export const ESIGN_ENVELOPE_NOT_FOUND = 'esignEnvelopeNotFound';
export const ESIGN_NO_EXTERNAL_ID = 'esignNoExternalId';
export const ESIGN_NOT_RECIPIENT = 'esignNotRecipient';

// ─── API Key ────────────────────────────────────────────────────
export const INVALID_API_KEY = 'invalidApiKey';
export const API_KEY_REVOKED = 'apiKeyRevoked';
export const API_KEY_EXPIRED = 'apiKeyExpired';
export const API_KEY_CANNOT_UPDATE_REVOKED = 'apiKeyCannotUpdateRevoked';

// ─── Tenant ─────────────────────────────────────────────────────
export const ORG_SUSPENDED = 'orgSuspended';
export const TENANT_NO_ACTIVE_ORGANIZATION = 'tenantNoActiveOrganization';

// ─── Approval (extended) ────────────────────────────────────────
export const APPROVAL_NO_USER_WITH_ROLE = 'approvalNoUserWithRole';

// ─── Workflow roles ─────────────────────────────────────────────
export const ROLE_TEMPLATE_NOT_FOUND = 'roleTemplateNotFound';

// ─── Classification ─────────────────────────────────────────────
export const SDS_APPROVAL_ALREADY_EXISTS = 'sdsApprovalAlreadyExists';
export const CLASSIFICATION_RATE_LIMITER_UNAVAILABLE = 'classificationRateLimiterUnavailable';
export const CLASSIFICATION_AUTOSAVE_RATE_LIMIT_EXCEEDED =
  'classificationAutosaveRateLimitExceeded';
export const CLASSIFICATION_ASSESSMENT_ID_REQUIRED = 'classificationAssessmentIdRequired';
export const CLASSIFICATION_ENGINE_DISABLED = 'classificationEngineDisabled';
export const CLASSIFICATION_ASSESSMENT_NOT_FOUND = 'classificationAssessmentNotFound';
export const CLASSIFICATION_ASSESSMENT_NOT_COMPLETED = 'classificationAssessmentNotCompleted';
export const CLASSIFICATION_GENERATE_SDS_IR35_ONLY = 'classificationGenerateSdsIr35Only';
export const SDS_NOT_APPROVED = 'sdsNotApproved';
export const CLASSIFICATION_DRV_BUNDLE_NOT_COMPLETED = 'classificationDrvBundleNotCompleted';
export const CLASSIFICATION_DRV_BUNDLE_DE_ONLY = 'classificationDrvBundleDeOnly';
export const CLASSIFICATION_ATTESTATION_REQUIRED = 'classificationAttestationRequired';
export const CLASSIFICATION_DOCUMENT_NOT_FOUND = 'classificationDocumentNotFound';
export const CLASSIFICATION_DRV_DE_ONLY = 'classificationDrvDeOnly';
export const FILE_SIZE_MISMATCH = 'fileSizeMismatch';
export const MIME_MAGIC_BYTE_MISMATCH = 'mimeMagicByteMismatch';
export const R2_UPLOAD_FAILED = 'r2UploadFailed';
export const DPA_NOT_AVAILABLE = 'dpaNotAvailable';
export const SCC_NOT_REQUIRED = 'sccNotRequired';
export const INVALID_TOS_VERSION_FORMAT = 'invalidTosVersionFormat';
export const REAUTH_REQUIRED = 'reauthRequired';
export const FEATURE_FLAG_UNAVAILABLE = 'featureFlagUnavailable';

// ─── Organization rate limit ────────────────────────────────────
export const ORGANIZATION_RATE_LIMITER_UNAVAILABLE = 'organizationRateLimiterUnavailable';
export const ORGANIZATION_CREATE_RATE_LIMIT_EXCEEDED = 'organizationCreateRateLimitExceeded';

// ─── Upload rate limit ──────────────────────────────────────────
export const UPLOAD_RATE_LIMITER_UNAVAILABLE = 'uploadRateLimiterUnavailable';
export const UPLOAD_RATE_LIMIT_EXCEEDED = 'uploadRateLimitExceeded';

// ─── Billing / Finance (extended) ───────────────────────────────
export const BILLING_PROFILE_NOT_FOUND = 'billingProfileNotFound';
export const WHT_NOT_APPLICABLE = 'whtNotApplicable';

// ─── Integrations (extended) ────────────────────────────────────
export const CLOCKIFY_CONNECTION_NOT_FOUND = 'clockifyConnectionNotFound';

// ─── Timesheets ─────────────────────────────────────────────────
export const TIMESHEET_NOT_FOUND = 'timesheetNotFound';
export const TIMESHEET_ENTRY_NOT_FOUND = 'timesheetEntryNotFound';
export const TIMESHEET_WEEK_START_DATE_MUST_BE_MONDAY = 'timesheetWeekStartDateMustBeMonday';
export const TIMESHEET_CANNOT_EDIT_IMPORTED = 'timesheetCannotEditImported';
export const TIMESHEET_CAN_ONLY_EDIT_DRAFT_OR_REJECTED = 'timesheetCanOnlyEditDraftOrRejected';
export const TIMESHEET_CANNOT_SUBMIT = 'timesheetCannotSubmit';
export const TIMESHEET_CANNOT_APPROVE = 'timesheetCannotApprove';
export const TIMESHEET_CANNOT_REJECT = 'timesheetCannotReject';

// ─── ZATCA onboarding ───────────────────────────────────────────
export const ZATCA_API_CLIENT_UNAVAILABLE = 'zatcaApiClientUnavailable';
export const ZATCA_COMPLIANCE_CHECKS_MUST_PASS = 'zatcaComplianceChecksMustPass';
export const ZATCA_COMPLIANCE_CSID_REQUIRED = 'zatcaComplianceCsidRequired';
export const ZATCA_CSR_REQUIRED = 'zatcaCsrRequired';
export const ZATCA_TAX_DETAILS_REQUIRED = 'zatcaTaxDetailsRequired';
export const ZATCA_TAX_DETAILS_REQUIRED_FOR_COMPLIANCE = 'zatcaTaxDetailsRequiredForCompliance';

// ─── Validation (import processor) ──────────────────────────────
export const VALIDATION_LEGAL_NAME_REQUIRED = 'validationLegalNameRequired';
export const VALIDATION_TAX_ID_REQUIRED = 'validationTaxIdRequired';
export const VALIDATION_EMAIL_REQUIRED = 'validationEmailRequired';
export const VALIDATION_EMAIL_INVALID = 'validationEmailInvalid';
export const VALIDATION_COUNTRY_CODE_LENGTH = 'validationCountryCodeLength';
export const VALIDATION_CURRENCY_LENGTH = 'validationCurrencyLength';
export const VALIDATION_CONTRACT_TITLE_REQUIRED = 'validationContractTitleRequired';
export const VALIDATION_CONTRACT_TYPE_REQUIRED = 'validationContractTypeRequired';
export const VALIDATION_START_DATE_REQUIRED = 'validationStartDateRequired';
export const VALIDATION_DATE_INVALID = 'validationDateInvalid';
export const VALIDATION_TAX_ID_FK_REQUIRED = 'validationTaxIdFkRequired';
