/**
 * Standardized error message keys for API responses.
 *
 * These keys are sent as TRPCError `message` values and translated
 * on the frontend via the `Errors` i18n namespace.
 *
 * Convention: SCREAMING_SNAKE_CASE so the frontend can detect them
 * via regex and look up translations automatically.
 */

// ─── Generic ─────────────────────────────────────────────────────
export const UNAUTHORIZED = 'unauthorized';
export const FORBIDDEN = 'forbidden';
export const ACCOUNT_BANNED = 'accountBanned';
export const LAST_ADMIN_CANNOT_DEACTIVATE = 'lastAdminCannotDeactivate';
export const PERMISSION_DENIED = 'permissionDenied';
export const UNKNOWN_ERROR = 'unknownError';

// ─── Contractor ──────────────────────────────────────────────────
export const CONTRACTOR_NOT_FOUND = 'contractorNotFound';
export const CONTRACTOR_HAS_UNPAID_INVOICES = 'contractorHasUnpaidInvoices';
export const CONTRACTOR_HAS_ACTIVE_WORKFLOWS = 'contractorHasActiveWorkflows';
export const CONTRACTOR_HAS_ACTIVE_CONTRACTS = 'contractorHasActiveContracts';
export const CONTRACTOR_INVALID_TRANSITION = 'contractorInvalidTransition';
export const GUS_LOOKUP_FAILED = 'gusLookupFailed';

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

// ─── API Key ────────────────────────────────────────────────────
export const INVALID_API_KEY = 'invalidApiKey';
export const API_KEY_REVOKED = 'apiKeyRevoked';
export const API_KEY_EXPIRED = 'apiKeyExpired';

// ─── Tenant ─────────────────────────────────────────────────────
export const ORG_SUSPENDED = 'orgSuspended';

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
