// Backward-compat barrel — import from ./invoice-intake/index.js for new code.
// biome-ignore lint/performance/noBarrelFile: intentional public aggregator — back-compat surface for the invoice-intake service
export {
  type AcknowledgeValidationInput,
  ALLOWED_PDF_MIMES,
  ALLOWED_XML_MIMES,
  acknowledgeValidation,
  type ConfirmMatchInput,
  type ConvertToInvoiceInput,
  type ConvertToInvoiceResult,
  confirmMatch,
  convertToInvoice,
  INTAKE_MAX_FILE_BYTES,
  type IntakeServiceDeps,
  type IntakeServiceError,
  type IntakeServiceErrorCode,
  type RejectInput,
  reject,
  type UploadFileKind,
  type UploadInput,
  type UploadResult,
  uploadAndPersist,
} from './invoice-intake/index.js';
