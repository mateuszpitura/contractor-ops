// ---------------------------------------------------------------------------
// @contractor-ops/einvoice — Pluggable E-Invoicing Engine
// ---------------------------------------------------------------------------

// Zod schemas
export {
  eInvoiceLineSchema,
  eInvoicePartySchema,
  eInvoicePaymentMeansSchema,
  eInvoiceSchema,
  eInvoiceTaxSubtotalSchema,
} from './schemas/invoice.js';
export type {
  ComplianceCapabilities,
  ComplianceState,
  ComplianceStatus,
} from './types/compliance.js';
export { complianceState } from './types/compliance.js';
// Core types
export type {
  EInvoice,
  EInvoiceLine,
  EInvoiceParty,
  EInvoicePaymentMeans,
  EInvoiceTaxSubtotal,
} from './types/invoice.js';
export type { PipelineStep } from './types/pipeline.js';
export type {
  CertificateInfo,
  EInvoiceProfile,
  QRCodeable,
  Signable,
  SignatureVerificationResult,
} from './types/profile.js';
export type { ValidationError, ValidationResult } from './types/validation.js';

// Registry
import { registerProfile as _registerProfile } from './registry.js';

// Engine
export { EInvoiceEngine } from './engine/engine.js';
export type {
  PipelineOptions,
  PipelineResult,
} from './engine/pipeline.js';

// Pipeline
export { runPipeline } from './engine/pipeline.js';
// XML utilities
export { dig, InvalidMinorUnitsValueError, toMinorUnits } from './engine/xml-utils.js';
export {
  clearProfiles,
  getProfile,
  listProfiles,
  registerProfile,
} from './registry.js';

// KSeF profile
import { KsefProfile as _KsefProfile } from './profiles/ksef/index.js';

// Storecove ASP adapter
export { StorecoveAdapter } from './asp/storecove/adapter.js';
export { StorecoveApiError, StorecoveClient } from './asp/storecove/client.js';
export type { StorecoveDiscoveryResponse } from './asp/storecove/schemas.js';
// ASP storecove schemas
export {
  extractDocumentTypes,
  storecoveDiscoveryResponseSchema,
} from './asp/storecove/schemas.js';
export type { StorecoveConfig } from './asp/storecove/types.js';
// ASP adapter types
export type {
  ASPAdapter,
  ASPHealthStatus,
  EInvoiceFormat as AspEInvoiceFormat,
  InboundInvoicePayload,
  LookupParticipantCapabilitiesParams,
  ParticipantCapabilityResult,
  ParticipantRegistration,
  ParticipantStatus,
  RegisterParticipantParams,
  TransmissionResult,
  TransmissionStatus,
  TransmitInvoiceParams,
  WebhookVerification,
} from './asp/types.js';
export type {
  KsefInvoiceMetadata,
  KsefQueryResult,
  KsefSession,
} from './profiles/ksef/api-client.js';
export { KsefApiClient } from './profiles/ksef/api-client.js';
export type { KsefConnectionData } from './profiles/ksef/compliance.js';
export { computeKsefComplianceStatus } from './profiles/ksef/compliance.js';
export { generateFa3Xml } from './profiles/ksef/generator.js';
export { KsefProfile } from './profiles/ksef/index.js';
export { ksefToEInvoice, mapKsefToInvoiceFields } from './profiles/ksef/mapper.js';
export { parseFa3Xml } from './profiles/ksef/parser.js';
export type {
  KsefConnectionConfig,
  KsefParsedInvoice,
  KsefSyncParams,
} from './profiles/ksef/schemas.js';
// KSeF schemas (backward compatibility)
export {
  ksefAuthMethodEnum,
  ksefConnectionConfigSchema,
  ksefEnvironmentEnum,
  ksefParsedInvoiceSchema,
  ksefSyncParamsSchema,
} from './profiles/ksef/schemas.js';

// Peppol-AE profile
import { PeppolAEProfile as _PeppolAEProfile } from './profiles/peppol-ae/index.js';

// Peppol-AE constants
export {
  PINT_AE_CUSTOMIZATION_ID,
  PINT_AE_DOCUMENT_TYPE_ID,
  PINT_AE_PROFILE_ID,
  UAE_SCHEME_ID,
  UAE_TAX_CATEGORIES,
  UAE_TAX_SCHEME_ID,
} from './profiles/peppol-ae/constants.js';
export { generatePintAeXml } from './profiles/peppol-ae/generator.js';
export type { PeppolConnectionData } from './profiles/peppol-ae/index.js';
export {
  computePeppolComplianceStatus,
  PeppolAEProfile,
} from './profiles/peppol-ae/index.js';
export { parsePintAeXml } from './profiles/peppol-ae/parser.js';
export { PeppolAEQRCode } from './profiles/peppol-ae/qr-code.js';
export type {
  PeppolConnectionConfig,
  PeppolTransmissionStatusType,
} from './profiles/peppol-ae/schemas.js';
// Peppol-AE schemas
export {
  peppolConnectionConfigSchema,
  peppolParticipantIdSchema,
  peppolTransmissionStatusSchema,
} from './profiles/peppol-ae/schemas.js';
export { validatePintAeXml } from './profiles/peppol-ae/validator.js';

// ZATCA profile
import { ZatcaProfile as _ZatcaProfile } from './profiles/zatca/index.js';

export type {
  ZatcaApiClientConfig,
  ZatcaClearanceResponse,
  ZatcaCsidResponse,
  ZatcaReportingResponse,
  ZatcaSubmissionPayload,
  ZatcaValidationResult,
} from './profiles/zatca/api-client.js';
// ZATCA API client
export {
  ZATCA_PRODUCTION_URL,
  ZATCA_SANDBOX_URL,
  ZatcaApiClient,
  ZatcaApiError,
} from './profiles/zatca/api-client.js';
export type { ZatcaConnectionData } from './profiles/zatca/compliance.js';
export { computeZatcaComplianceStatus } from './profiles/zatca/compliance.js';
export { generateZatcaXml } from './profiles/zatca/generator.js';
export { ZatcaProfile } from './profiles/zatca/index.js';
export { buildComplianceTestInvoices, generateZatcaCsr } from './profiles/zatca/onboarding.js';
export { parseZatcaXml } from './profiles/zatca/parser.js';
export { ZatcaTLVQRCode } from './profiles/zatca/qr-code.js';
export type {
  ZatcaConnectionConfig,
  ZatcaCsrAttributes,
  ZatcaEnvironment,
  ZatcaInvoiceFields,
  ZatcaOnboardingStepType,
  ZatcaTaxDetails,
} from './profiles/zatca/schemas.js';
// ZATCA schemas
export {
  zatcaConnectionConfigSchema,
  zatcaCsrAttributesSchema,
  zatcaEnvironmentSchema,
  zatcaInvoiceFieldsSchema,
  zatcaOnboardingStepSchema,
  zatcaTaxDetailsSchema,
} from './profiles/zatca/schemas.js';
// ZATCA signer and QR
export { ZatcaXAdESSigner } from './profiles/zatca/signer.js';
// ZATCA types
export type {
  ZatcaInvoiceExtensions,
  ZatcaInvoiceSubtype,
  ZatcaInvoiceType,
  ZatcaInvoiceTypeCode,
  ZatcaOnboardingState,
  ZatcaOnboardingStep,
  ZatcaProfileId,
} from './profiles/zatca/types.js';
export { ZatcaTlvTag } from './profiles/zatca/types.js';

// XRechnung-DE profile
import { XRechnungDEProfile as _XRechnungDEProfile } from './profiles/xrechnung-de/index.js';

// XRechnung-DE constants
export {
  CII_DOCUMENT_TYPE_COMMERCIAL_INVOICE,
  KOSIT_RULE_SET_VERSION,
  QDT_NS as XRECHNUNG_QDT_NS,
  RAM_NS as XRECHNUNG_RAM_NS,
  RSM_NS as XRECHNUNG_RSM_NS,
  STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID,
  UDT_NS as XRECHNUNG_UDT_NS,
  XRECHNUNG_BUSINESS_PROCESS_TYPE,
  XRECHNUNG_CUSTOMIZATION_ID,
  XRECHNUNG_DE_PROFILE_ID,
  XRECHNUNG_PROFILE_ID,
  XRECHNUNG_VERSION,
} from './profiles/xrechnung-de/constants.js';
export type { CiiDocShape } from './profiles/xrechnung-de/generator.js';
export { generateXRechnungCii } from './profiles/xrechnung-de/generator.js';
// Re-export SkontoTermInput at the package root so api-side callers can
// import the type without reaching into the xrechnung-de subpath.
export type { SkontoTermInput, XRechnungGenerateOptions } from './profiles/xrechnung-de/index.js';
export { XRechnungDEProfile } from './profiles/xrechnung-de/index.js';
export { embedLeitwegIdIntoCii } from './profiles/xrechnung-de/leitweg-id-embed.js';
export { parseXRechnungCii } from './profiles/xrechnung-de/parser.js';
// XRechnung-DE schemas
export type {
  EInvoiceFormat,
  FinalizeEInvoiceInput,
} from './profiles/xrechnung-de/schemas.js';
export {
  eInvoiceFormatSchema,
  finalizeEInvoiceInputSchema,
} from './profiles/xrechnung-de/schemas.js';
export type {
  NormalisedSvrl,
  ValidationIssue as XRechnungValidationIssue,
} from './profiles/xrechnung-de/svrl-normalizer.js';
// XRechnung-DE three-layer KoSIT validator
export { normaliseSvrl } from './profiles/xrechnung-de/svrl-normalizer.js';
export type {
  ValidationLayerName,
  ValidationLayerReport,
  ValidationLayerStatus,
  XRechnungValidationReport,
} from './profiles/xrechnung-de/validator.js';
export { validateXRechnungCii } from './profiles/xrechnung-de/validator.js';

// Convenience: register KSeF profile
export function registerKsefProfile(options?: ConstructorParameters<typeof _KsefProfile>[0]): void {
  const profile = new _KsefProfile(options);
  _registerProfile(profile);
}

// Convenience: register Peppol-AE profile
export function registerPeppolAEProfile(
  options?: ConstructorParameters<typeof _PeppolAEProfile>[0],
): void {
  const profile = new _PeppolAEProfile(options);
  _registerProfile(profile);
}

// Convenience: register ZATCA profile
export function registerZatcaProfile(
  options?: ConstructorParameters<typeof _ZatcaProfile>[0],
): void {
  const profile = new _ZatcaProfile(options);
  _registerProfile(profile);
}

// Convenience: register XRechnung-DE profile
export function registerXRechnungDEProfile(): void {
  const profile = new _XRechnungDEProfile();
  _registerProfile(profile);
}

// ---------------------------------------------------------------------------
// ZUGFeRD-DE profile (hybrid PDF/A-3 + embedded CII)
// ---------------------------------------------------------------------------

import { ZugferdDEProfile as _ZugferdDEProfile } from './profiles/zugferd-de/index.js';

export type {
  ParsedXrechnung,
  ParserError as XRechnungParserError,
  ParserWarning as XRechnungParserWarning,
} from './profiles/xrechnung-de/parser.js';
// XRechnung inbound parser — Phase-62 fully implemented.
// Named export is the richer typed parser (ParsedXrechnung), separate from
// the Phase-61 back-compat `parseXRechnungCii` already exported above.
export { CIIParserError, parseXrechnungCii } from './profiles/xrechnung-de/parser.js';
export type { ZugferdConformanceLevel } from './profiles/zugferd-de/constants.js';
// ZUGFeRD-DE constants + types
export {
  GUIDELINE_URN_TO_LEVEL,
  PDFA_ID_CONFORMANCE,
  PDFA_ID_NAMESPACE,
  PDFA_ID_PART,
  UNSUPPORTED_GUIDELINE_URNS,
  ZUGFERD_AF_RELATIONSHIP,
  ZUGFERD_ATTACHMENT_FILENAME,
  ZUGFERD_ATTACHMENT_MIME,
  ZUGFERD_DE_PROFILE_ID,
  ZUGFERD_XMP_DOCUMENT_FILE_NAME,
  ZUGFERD_XMP_DOCUMENT_TYPE,
  ZUGFERD_XMP_NAMESPACE,
  ZUGFERD_XMP_PREFIX,
  ZUGFERD_XMP_VERSION,
} from './profiles/zugferd-de/constants.js';
export type { GenerateZugferdInput } from './profiles/zugferd-de/generator.js';
// ZUGFeRD-DE outbound pipeline
export {
  generateZugferdPdf,
  ZugferdLevelUnsupportedForOutput,
} from './profiles/zugferd-de/generator.js';
// ZUGFeRD-DE profile class
export { ZugferdDEProfile } from './profiles/zugferd-de/index.js';
export type {
  ParsedZugferd,
  ZugferdParserError,
} from './profiles/zugferd-de/parser.js';
// ZUGFeRD-DE parser + delegate validator
export { parseZugferdPdf, ZugferdParserErrorClass } from './profiles/zugferd-de/parser.js';
export type { ZugferdPdfUpload } from './profiles/zugferd-de/schemas.js';
// ZUGFeRD-DE upload schema (Plan 05 intake route)
export { ZugferdPdfUploadSchema } from './profiles/zugferd-de/schemas.js';
export { validateZugferdEmbeddedXml } from './profiles/zugferd-de/validator.js';
export type { StructuralCheckSubcode } from './profiles/zugferd-de/zugferd-structural-check.js';
export {
  assertZugferdStructure,
  ZugferdWrappingError,
} from './profiles/zugferd-de/zugferd-structural-check.js';

// Convenience: register ZUGFeRD-DE profile
export function registerZugferdDEProfile(): void {
  const profile = new _ZugferdDEProfile();
  _registerProfile(profile);
}

export {
  generateOutboundXRechnungCii,
  generateOutboundZugferdPdf,
  parseInboundPdf,
  parseInboundXml,
  validateInboundEmbeddedXml,
  validateInboundXRechnungCii,
} from './orchestration/index.js';
