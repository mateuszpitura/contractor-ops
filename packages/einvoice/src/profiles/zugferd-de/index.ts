// ZUGFeRD profile barrel.
//
// Public surface consumed by:
//   * `packages/einvoice/src/registry.ts` — profile registration
//   * `packages/einvoice/src/index.ts` — top-level package re-export
//   * `packages/api/src/services/invoice-intake-service.ts` — intake pipeline

export {
  GUIDELINE_URN_TO_LEVEL,
  PDFA_ID_CONFORMANCE,
  PDFA_ID_NAMESPACE,
  PDFA_ID_PART,
  UNSUPPORTED_GUIDELINE_URNS,
  XRECHNUNG_VERSION,
  ZUGFERD_AF_RELATIONSHIP,
  ZUGFERD_ATTACHMENT_FILENAME,
  ZUGFERD_ATTACHMENT_MIME,
  ZUGFERD_DE_PROFILE_ID,
  ZUGFERD_XMP_DOCUMENT_FILE_NAME,
  ZUGFERD_XMP_DOCUMENT_TYPE,
  ZUGFERD_XMP_NAMESPACE,
  ZUGFERD_XMP_PREFIX,
  ZUGFERD_XMP_VERSION,
  type ZugferdConformanceLevel,
} from './constants.js';
export type { GenerateZugferdInput } from './generator.js';
// Outbound pipeline.
export {
  generateZugferdPdf,
  ZugferdLevelUnsupportedForOutput,
} from './generator.js';
export type { ParsedZugferd, ZugferdParserError } from './parser.js';
export { parseZugferdPdf, ZugferdParserErrorClass } from './parser.js';
export { ZugferdDEProfile } from './profile.js';
export {
  EInvoiceLineSchema,
  EInvoiceSchema,
  eInvoicePartySchema,
  eInvoicePaymentMeansSchema,
  eInvoiceTaxSubtotalSchema,
  type ZugferdPdfUpload,
  ZugferdPdfUploadSchema,
} from './schemas.js';
export { validateZugferdEmbeddedXml } from './validator.js';
export type { StructuralCheckSubcode } from './zugferd-structural-check.js';
export {
  assertZugferdStructure,
  ZugferdWrappingError,
} from './zugferd-structural-check.js';
