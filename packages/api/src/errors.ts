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
export const CONTRACT_ONLY_DRAFT_CAN_BE_DELETED = 'contractOnlyDraftCanBeDeleted';

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

// ─── OCR ─────────────────────────────────────────────────────────
export const OCR_EXTRACTION_NOT_FOUND = 'ocrExtractionNotFound';

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

// ─── E-Invoice ──────────────────────────────────────────────────
export const EINVOICE_INVOICE_NOT_FOUND = 'einvoiceInvoiceNotFound';
export const EINVOICE_LIFECYCLE_NOT_FOUND = 'einvoiceLifecycleNotFound';
export const EINVOICE_XML_NOT_FOUND = 'einvoiceXmlNotFound';
export const EINVOICE_REPORT_NOT_FOUND = 'einvoiceReportNotFound';
export const EINVOICE_TRANSMISSION_IN_PROGRESS = 'einvoiceTransmissionInProgress';
export const ZUGFERD_LEVEL_UNSUPPORTED_FOR_OUTPUT = 'zugferdLevelUnsupportedForOutput';
export const ZUGFERD_WRAPPING_FAILED = 'zugferdWrappingFailed';
export const KOSIT_VALIDATION_FAILED = 'kositValidationFailed';
export const PEPPOL_NOT_CONNECTED = 'peppolNotConnected';
export const STORECOVE_TRANSMISSION_FAILED = 'storecoveTransmissionFailed';

// ─── Portal (extended) ──────────────────────────────────────────
export const PORTAL_ALREADY_ACTIVE_ORG = 'portalAlreadyActiveOrg';

// ─── Equipment returns ─────────────────────────────────────────
export const NO_EQUIPMENT_ASSIGNED = 'noEquipmentAssigned';
export const RETURN_ALREADY_PENDING = 'returnAlreadyPending';
export const RETURN_REQUEST_NOT_FOUND = 'returnRequestNotFound';
export const RETURN_CANNOT_CANCEL = 'returnCannotCancel';
export const RETURN_LABEL_NOT_AVAILABLE = 'returnLabelNotAvailable';
export const SHIPMENT_NO_INPOST_LABEL = 'shipmentNoInpostLabel';

// ─── Payment (extended) ─────────────────────────────────────────
export const PAYMENT_RUN_CREATION_IN_PROGRESS = 'paymentRunCreationInProgress';
export const PAYMENT_RUN_NUMBER_COLLISION = 'paymentRunNumberCollision';
export const PAYMENT_BANK_STATEMENT_EXPORTED_ONLY = 'paymentBankStatementExportedOnly';
export const PAYMENT_INVOICE_NOT_SKONTO_ELIGIBLE = 'paymentInvoiceNotSkontoEligible';
export const PAYMENT_NO_SKONTO_TERM = 'paymentNoSkontoTerm';

// ─── Billing / Subscriptions ────────────────────────────────────
export const BILLING_INVALID_SUBSCRIPTION_PRICE_ID = 'billingInvalidSubscriptionPriceId';
export const BILLING_ORGANIZATION_NOT_FOUND = 'billingOrganizationNotFound';
export const BILLING_NO_ACTIVE_SUBSCRIPTION = 'billingNoActiveSubscription';
export const BILLING_SUBSCRIPTION_ITEM_UNAVAILABLE = 'billingSubscriptionItemUnavailable';
export const BILLING_INVALID_TOPUP_PRICE_ID = 'billingInvalidTopupPriceId';
export const BILLING_NO_SUBSCRIPTION_SUBSCRIBE_FIRST = 'billingNoSubscriptionSubscribeFirst';

// ─── Jira integration ───────────────────────────────────────────
export const JIRA_MISSING_CLOUD_ID = 'jiraMissingCloudId';
export const JIRA_CONNECTION_NOT_ACTIVE = 'jiraConnectionNotActive';
export const JIRA_CONNECTION_NOT_FOUND = 'jiraConnectionNotFound';
export const JIRA_TOKEN_INVALID = 'jiraTokenInvalid';
export const JIRA_CREATE_FAILED = 'jiraCreateFailed';
export const JIRA_TRANSITION_FAILED = 'jiraTransitionFailed';
export const JIRA_WORKLOG_SYNC_FAILED = 'jiraWorklogSyncFailed';
export const JIRA_WEBHOOK_PROCESSING_FAILED = 'jiraWebhookProcessingFailed';

// ─── Linear integration ────────────────────────────────────────
export const LINEAR_NO_DATA = 'linearNoData';
export const LINEAR_CONNECTION_NOT_ACTIVE = 'linearConnectionNotActive';
export const LINEAR_CREATE_FAILED = 'linearCreateFailed';
export const LINEAR_SYNC_FAILED = 'linearSyncFailed';
export const LINEAR_WEBHOOK_PROCESSING_FAILED = 'linearWebhookProcessingFailed';
export const LINEAR_WEBHOOK_CREATE_FAILED = 'linearWebhookCreateFailed';

// ─── Workflow ───────────────────────────────────────────────────
export const WORKFLOW_TASK_RUN_NOT_FOUND = 'workflowTaskRunNotFound';

// ─── Clockify integration ──────────────────────────────────────
export const CLOCKIFY_SYNC_FAILED = 'clockifySyncFailed';
export const CLOCKIFY_CONFIG_INCOMPLETE = 'clockifyConfigIncomplete';

// ─── Invoice intake (multi-line) ───────────────────────────────
export const FILE_TOO_LARGE = 'fileTooLarge';
export const UNSUPPORTED_MIME = 'unsupportedMime';
export const CII_XSD_INVALID = 'ciiXsdInvalid';
export const INVALID_STATE_TRANSITION = 'invalidStateTransition';
export const VALIDATION_NOT_REQUIRED = 'validationNotRequired';
export const REASON_TOO_SHORT = 'reasonTooShort';
export const DUPLICATE_INVOICE_NUMBER = 'duplicateInvoiceNumber';
export const INTAKE_INTERNAL_ERROR = 'intakeInternalError';

// ─── IR35 chain ────────────────────────────────────────────────
export const IR35_ENGAGEMENT_NOT_FOUND = 'ir35EngagementNotFound';
export const IR35_LINKED_CONTRACTOR_NOT_FOUND = 'ir35LinkedContractorNotFound';
export const IR35_CLIENT_CANNOT_HAVE_LINKED_CONTRACTOR = 'ir35ClientCannotHaveLinkedContractor';
export const IR35_DUPLICATE_IDS = 'ir35DuplicateIds';
export const IR35_ORDERED_IDS_MUST_LIST_ALL = 'ir35OrderedIdsMustListAll';
export const IR35_PARTICIPANT_NOT_FOUND = 'ir35ParticipantNotFound';
export const IR35_CLIENT_WORKER_CANNOT_BE_REMOVED = 'ir35ClientWorkerCannotBeRemoved';

// ─── Classification (extended) ─────────────────────────────────
export const CLASSIFICATION_ONLY_DRAFT_CAN_RECREATE = 'classificationOnlyDraftCanRecreate';
export const CLASSIFICATION_NO_DRIFT_TO_RECOVER = 'classificationNoDriftToRecover';
export const CLASSIFICATION_ASSESSMENT_NOT_DRAFT = 'classificationAssessmentNotDraft';
export const CLASSIFICATION_ALREADY_SUBMITTED = 'classificationAlreadySubmitted';
export const CLASSIFICATION_ONLY_COMPLETED_CAN_ACKNOWLEDGE =
  'classificationOnlyCompletedCanAcknowledge';
export const CLASSIFICATION_SDS_APPROVAL_IR35_ONLY = 'classificationSdsApprovalIr35Only';

// ─── BACS / Payments (extended) ────────────────────────────────
export const BACS_SUBMITTER_NOT_CONFIGURED = 'bacsSubmitterNotConfigured';

// ─── Batch 3 (remaining sweep) ─────────────────────────────────
export const INVOICE_INTEREST_WAIVER_EXISTS = 'invoiceInterestWaiverExists';
export const WORKFLOW_TEMPLATE_HAS_RUNS = 'workflowTemplateHasRuns';
export const LEITWEG_ID_NOT_CONTRACTOR_DEFAULT = 'leitwegIdNotContractorDefault';
export const CANNOT_DEACTIVATE_SELF = 'cannotDeactivateSelf';
export const LINEAR_WRONG_CONNECTION_ID = 'linearWrongConnectionId';
export const CONTRACTOR_NO_VAT_ID = 'contractorNoVatId';
export const COURIER_CONFIG_NOT_FOUND = 'courierConfigNotFound';
export const SKONTO_DISCOUNT_PERIOD_INVALID = 'skontoDiscountPeriodInvalid';
export const DOC_LINK_NOT_FOUND = 'docLinkNotFound';
export const EXPORT_ENQUEUE_FAILED = 'exportEnqueueFailed';
export const EINVOICE_FAILED_TRANSMISSION_NOT_RETRYABLE = 'einvoiceFailedTransmissionNotRetryable';
export const GOOGLE_WORKSPACE_ADAPTER_NOT_REGISTERED = 'googleWorkspaceAdapterNotRegistered';
export const GOOGLE_WORKSPACE_NOT_CONNECTED = 'googleWorkspaceNotConnected';
export const INTEGRATION_CONNECTION_NOT_FOUND = 'integrationConnectionNotFound';
export const INTEREST_ALREADY_CLAIMED = 'interestAlreadyClaimed';
export const INVOICE_MUST_BE_MATCHED = 'invoiceMustBeMatched';
export const KLEINUNTERNEHMER_DE_ONLY = 'kleinunternehmerDeOnly';
export const KSEF_CREDENTIAL_VERIFICATION_FAILED = 'ksefCredentialVerificationFailed';
export const LEITWEG_ID_EXISTS = 'leitwegIdExists';
export const PROJECT_MERGE_ID_NOT_CANDIDATE = 'projectMergeIdNotCandidate';
export const PROJECT_MERGE_ID_REQUIRED = 'projectMergeIdRequired';
export const TIMESHEET_NO_ACTIVE_CONTRACT = 'timesheetNoActiveContract';
export const APPROVAL_NO_CHAIN_CONFIGURED = 'approvalNoChainConfigured';
export const INTEREST_NOTHING_TO_CLAIM = 'interestNothingToClaim';
export const PORTAL_NO_IP_VERIFICATION_TASK = 'portalNoIpVerificationTask';
export const TEMPLATE_CODES_ALREADY_EXIST = 'templateCodesAlreadyExist';
export const WORKFLOW_TEMPLATE_ONLY_DRAFT_DELETE = 'workflowTemplateOnlyDraftDelete';
export const TRIGGER_NOT_DISMISSIBLE = 'triggerNotDismissible';
export const TRIGGER_NOT_ACKNOWLEDGEABLE = 'triggerNotAcknowledgeable';
export const PEPPOL_ALREADY_CONNECTED = 'peppolAlreadyConnected';
export const KSEF_REQUIRES_NIP = 'ksefRequiresNip';
export const PENDING_UPLOAD_INVALID = 'pendingUploadInvalid';
export const RETURN_REQUEST_NOT_PENDING = 'returnRequestNotPending';
export const WORKFLOW_TEMPLATE_SEED_NO_DELETE = 'workflowTemplateSeedNoDelete';
export const WORKFLOW_TEMPLATE_SEED_NO_UPDATE = 'workflowTemplateSeedNoUpdate';
export const SERVICE_PERIOD_END_BEFORE_START = 'servicePeriodEndBeforeStart';
export const TIMESHEET_NOT_FOUND_LEGACY = 'timesheetNotFoundLegacy';
export const TOKEN_REQUIRED = 'tokenRequired';
export const STATUS_VAL_DATES_REQUIRED = 'statusValDatesRequired';
export const CONTRACTOR_INVALID_NIP = 'contractorInvalidNip';
export const VAT_VALIDATION_UNSUPPORTED_COUNTRY = 'vatValidationUnsupportedCountry';
export const BACS_UNMAPPABLE_CHARACTERS = 'bacsUnmappableCharacters';
export const PAYMENT_RUN_CANCEL_ADMIN_ONLY = 'paymentRunCancelAdminOnly';
export const CLASSIFICATION_STALE_ANSWER = 'classificationStaleAnswer';
export const CLOCKIFY_API_KEY_INVALID = 'clockifyApiKeyInvalid';
export const JIRA_TASK_NOT_CONFIGURED = 'jiraTaskNotConfigured';
export const JIRA_ACCOUNT_NOT_MAPPED = 'jiraAccountNotMapped';
export const LINEAR_TOKEN_INVALID = 'linearTokenInvalid';
export const GDPR_CONFIRM_PHRASE_REQUIRED = 'gdprConfirmPhraseRequired';
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
export const CLOCKIFY_CONNECTION_NOT_ACTIVE = 'clockifyConnectionNotActive';

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
export const ZATCA_INVOICE_NOT_RESUBMITTABLE = 'zatcaInvoiceNotResubmittable';

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

// ─── Phase 75 — Credential vault + IP-verification gate ─────────
export const CREDENTIAL_REFERENCE_NOT_FOUND = 'credentialReferenceNotFound';
export const CREDENTIAL_REFERENCE_OFFBOARDING_ONLY = 'credentialReferenceOffboardingOnly';
export const WORKFLOW_IP_VERIFICATION_OPEN = 'workflowIpVerificationOpen';
export const WORKFLOW_CREDENTIALS_PENDING = 'workflowCredentialsPending';

// ─── Phase 76 — F2 IdP deprovisioning saga + cooldown gate ─────────
export const DEPROVISIONING_ASSIGNMENT_NOT_FOUND = 'deprovisioningAssignmentNotFound';
export const DEPROVISIONING_STEP_NOT_FOUND = 'deprovisioningStepNotFound';
export const DEPROVISIONING_COOLDOWN_ACTIVE = 'deprovisioningCooldownActive';
export const DEPROVISIONING_NO_EXTERNAL_USER = 'deprovisioningNoExternalUser';

// ─── Phase 77 — F2 IdP override + per-provider enable + org-grid connect ──
export const DEPROVISIONING_STEP_NOT_OVERRIDABLE = 'deprovisioningStepNotOverridable';
export const DEPROVISIONING_PROVIDER_SIGNOFF_PENDING = 'deprovisioningProviderSignoffPending';
export const DEPROVISIONING_INTEGRATION_NOT_CONFIGURED = 'deprovisioningIntegrationNotConfigured';

// ─── Phase 72 — F1 compliance payment block (COMPL-05) ─────────────
export const COMPLIANCE_PAYMENT_BLOCKED = 'compliancePaymentBlocked';

// ─── Phase 72 — F1 PENDING_COMPLIANCE recovery (COMPL-06) ──────────
export const APPROVAL_FLOW_NOT_FOUND = 'approvalFlowNotFound';
export const APPROVAL_NOT_PENDING_COMPLIANCE = 'approvalNotPendingCompliance';
export const APPROVAL_CANNOT_RESOLVE_CONTRACTOR = 'approvalCannotResolveContractor';
export const APPROVAL_STILL_COMPLIANCE_BLOCKED = 'approvalStillComplianceBlocked';

// ─── Phase 73 — F1 compliance admin override + audit trail (COMPL-01) ──────────
export const COMPLIANCE_ITEM_NOT_FOUND = 'complianceItemNotFound';
export const COMPLIANCE_ITEM_ALREADY_WAIVED = 'complianceItemAlreadyWaived';
export const COMPLIANCE_DOCUMENT_NOT_PENDING_REVIEW = 'complianceDocumentNotPendingReview';
