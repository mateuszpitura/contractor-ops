// ---------------------------------------------------------------------------
// @contractor-ops/einvoice — Pluggable E-Invoicing Engine
// ---------------------------------------------------------------------------

// Core types
export type {
  EInvoice,
  EInvoiceParty,
  EInvoiceLine,
  EInvoiceTaxSubtotal,
  EInvoicePaymentMeans,
} from "./types/invoice.js";

export type {
  EInvoiceProfile,
  CertificateInfo,
  SignatureVerificationResult,
  Signable,
  QRCodeable,
} from "./types/profile.js";

export type {
  ComplianceState,
  ComplianceCapabilities,
  ComplianceStatus,
} from "./types/compliance.js";

export type { ValidationResult, ValidationError } from "./types/validation.js";

// Zod schemas
export {
  eInvoiceSchema,
  eInvoicePartySchema,
  eInvoiceLineSchema,
  eInvoiceTaxSubtotalSchema,
  eInvoicePaymentMeansSchema,
} from "./schemas/invoice.js";

// Registry
import { registerProfile as _registerProfile } from "./registry.js";
export {
  registerProfile,
  getProfile,
  listProfiles,
  clearProfiles,
} from "./registry.js";

// Engine
export { EInvoiceEngine } from "./engine/engine.js";

// Pipeline
export { runPipeline } from "./engine/pipeline.js";
export type { PipelineResult, PipelineOptions } from "./engine/pipeline.js";

// XML utilities
export { dig, toMinorUnits } from "./engine/xml-utils.js";

// KSeF profile
import { KsefProfile as _KsefProfile } from "./profiles/ksef/index.js";
export { KsefProfile } from "./profiles/ksef/index.js";
export { parseFa3Xml } from "./profiles/ksef/parser.js";
export { mapKsefToInvoiceFields, ksefToEInvoice } from "./profiles/ksef/mapper.js";
export { generateFa3Xml } from "./profiles/ksef/generator.js";
export { KsefApiClient } from "./profiles/ksef/api-client.js";
export type {
  KsefSession,
  KsefInvoiceMetadata,
  KsefQueryResult,
} from "./profiles/ksef/api-client.js";
export {
  computeKsefComplianceStatus,
} from "./profiles/ksef/compliance.js";
export type { KsefConnectionData } from "./profiles/ksef/compliance.js";

// KSeF schemas (backward compatibility)
export {
  ksefConnectionConfigSchema,
  ksefParsedInvoiceSchema,
  ksefSyncParamsSchema,
  ksefAuthMethodEnum,
  ksefEnvironmentEnum,
} from "./profiles/ksef/schemas.js";
export type {
  KsefConnectionConfig,
  KsefParsedInvoice,
  KsefSyncParams,
} from "./profiles/ksef/schemas.js";

// ASP adapter types
export type {
  ASPAdapter,
  RegisterParticipantParams,
  ParticipantRegistration,
  ParticipantStatus,
  TransmitInvoiceParams,
  TransmissionResult,
  TransmissionStatus,
  InboundInvoicePayload,
  WebhookVerification,
  ASPHealthStatus,
} from "./asp/types.js";

// Storecove ASP adapter
export { StorecoveAdapter } from "./asp/storecove/adapter.js";
export { StorecoveClient, StorecoveApiError } from "./asp/storecove/client.js";
export type { StorecoveConfig } from "./asp/storecove/types.js";

// Peppol-AE profile
import { PeppolAEProfile as _PeppolAEProfile } from "./profiles/peppol-ae/index.js";
export { PeppolAEProfile } from "./profiles/peppol-ae/index.js";
export { generatePintAeXml } from "./profiles/peppol-ae/generator.js";
export { parsePintAeXml } from "./profiles/peppol-ae/parser.js";
export { validatePintAeXml } from "./profiles/peppol-ae/validator.js";
export { PeppolAEQRCode } from "./profiles/peppol-ae/qr-code.js";
export {
  computePeppolComplianceStatus,
} from "./profiles/peppol-ae/index.js";
export type { PeppolConnectionData } from "./profiles/peppol-ae/index.js";

// Peppol-AE schemas
export {
  peppolParticipantIdSchema,
  peppolConnectionConfigSchema,
  peppolTransmissionStatusSchema,
} from "./profiles/peppol-ae/schemas.js";
export type {
  PeppolConnectionConfig,
  PeppolTransmissionStatusType,
} from "./profiles/peppol-ae/schemas.js";

// Peppol-AE constants
export {
  PINT_AE_CUSTOMIZATION_ID,
  PINT_AE_PROFILE_ID,
  UAE_SCHEME_ID,
  PINT_AE_DOCUMENT_TYPE_ID,
  UAE_TAX_SCHEME_ID,
  UAE_TAX_CATEGORIES,
} from "./profiles/peppol-ae/constants.js";

// Convenience: register KSeF profile
export function registerKsefProfile(
  options?: ConstructorParameters<typeof _KsefProfile>[0],
): void {
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
