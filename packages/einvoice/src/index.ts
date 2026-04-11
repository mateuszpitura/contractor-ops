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

// Convenience: register KSeF profile
export function registerKsefProfile(
  options?: ConstructorParameters<typeof _KsefProfile>[0],
): void {
  const profile = new _KsefProfile(options);
  _registerProfile(profile);
}
