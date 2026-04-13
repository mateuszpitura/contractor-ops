// ---------------------------------------------------------------------------
// @contractor-ops/einvoice — Pluggable E-Invoicing Engine
// ---------------------------------------------------------------------------

// biome-ignore lint/performance/noBarrelFile: package entry point
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
export { dig, toMinorUnits } from './engine/xml-utils.js';
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
export type { StorecoveConfig } from './asp/storecove/types.js';
// ASP adapter types
export type {
  ASPAdapter,
  ASPHealthStatus,
  InboundInvoicePayload,
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
