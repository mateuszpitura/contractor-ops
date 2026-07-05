// Form 1042-S IRIS transmit tail.
//
// Sibling of the shared `tax-filing-transmitter` seam for the Publication 1187
// 1042-S schema: one build+validate pipeline (`buildIris1042SXml` ->
// `xsdValidate1042S`) reusing the `@contractor-ops/iris` primitives verbatim.
// The GA-safe path is ManualDownload — staff download the XSD-validated 1042-S
// XML and upload it to IRIS, then upload the returned acknowledgement (parsed by
// the single shared `iris-ack-parser`). No IRS Transmitter Control Code needed.
//
// A missing IRS Pub 1187 XSD bundle is the expected pre-enablement state:
// `xsdValidate1042S` returns BUNDLE_UNAVAILABLE (never throws), so the pipeline
// never files on unproven XML and never crashes when the bundle is absent. The
// caller records the IrisSubmission row (it holds the session org + tx).

import type { Iris1042SSubmissionInput, IrisValidationReport } from '@contractor-ops/iris';
import { buildIris1042SXml, xsdValidate1042S } from '@contractor-ops/iris';

export interface Transmit1042SResult {
  /** The XSD validation report for the generated 1042-S XML. */
  validation: IrisValidationReport;
  /**
   * The XSD-validated 1042-S IRIS XML, present ONLY when validation passed. The
   * manual path returns this for admin download; it is never populated on an
   * INVALID or BUNDLE_UNAVAILABLE report (validity unproven -> do not file).
   */
  xml?: string;
  /** True when the pipeline produced a fileable/downloadable artifact. */
  ready: boolean;
}

/**
 * Run the shared 1042-S build+validate pipeline. Returns the validated XML only
 * on a VALID report; an INVALID or BUNDLE_UNAVAILABLE report yields `ready:false`
 * and no XML (validity unproven -> the caller must not file).
 */
export async function buildAndValidate1042S(
  input: Iris1042SSubmissionInput,
): Promise<Transmit1042SResult> {
  const xml = buildIris1042SXml(input);
  const validation = await xsdValidate1042S(xml);

  if (validation.status !== 'VALID') {
    return { validation, ready: false };
  }
  return { validation, xml, ready: true };
}
