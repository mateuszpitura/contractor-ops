// ---------------------------------------------------------------------------
// IRIS (IRS Information Returns Intake System) XML package.
//
// Deferred seam: nothing here is wired into a runtime path yet — the package
// ships ahead of the e-file transmit phase that will consume it. The generators
// and types are built and tested, so this reads as complete but is currently
// unreachable, not dead code.
//
// The XSD validators (`xsdValidate` / `xsdValidate1042S`) need the official IRS
// XSD bundle, whose download is a human checkpoint. Until that bundle is placed
// the validators return an INVALID report with an `XSD-BUNDLE-MISSING`
// diagnostic by design.
// ---------------------------------------------------------------------------

export { buildIris1042SXml, buildIrisXml } from './generator.js';
export type {
  Iris1042SRecipient,
  Iris1042SSubmissionInput,
  Iris1042SWithholdingAgent,
  IrisPayee,
  IrisPayer,
  IrisSchemaVersion,
  IrisSubmissionInput,
  IrisValidationError,
  IrisValidationReport,
} from './types.js';
export { xsdValidate, xsdValidate1042S } from './validator.js';
