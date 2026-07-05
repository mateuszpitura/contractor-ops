// Tax-filing transmitter factory.
//
// One generation pipeline (buildIrisXml -> xsdValidate) with a swappable
// transmit tail, mirroring the payment-export format factory. The default
// GA-safe path is ManualDownload: it needs no IRS Transmitter Control Code
// (TCC) — staff download the XSD-validated IRIS XML and upload it to IRIS, then
// upload the returned ack file (parsed by the single iris-ack-parser). The live
// IRIS A2A path is built but DARK behind `module.iris-efile`: its SOAP/MTOM
// transport is a documented seam off the GA critical path. Vendor is a stub.
//
// A missing IRS XSD bundle is the expected pre-enablement state: xsdValidate
// returns BUNDLE_UNAVAILABLE (never throws), so the transmitter never files on
// unproven XML and never crashes when the bundle is absent. Recording the
// IrisSubmission row is the caller's job (it holds the session org + tx).

import { evaluate } from '@contractor-ops/feature-flags';
import type { IrisSubmissionInput, IrisValidationReport } from '@contractor-ops/iris';
import { buildIrisXml, xsdValidate } from '@contractor-ops/iris';
import { createLogger } from '@contractor-ops/logger';

const log = createLogger({ service: 'tax-filing-transmitter' });

/** Which transmit tail generated the artifact. Persisted on IrisSubmission. */
export type TransmitMethod = 'manual' | 'iris-a2a' | 'vendor';

/** Region coercion for the Unleash client map (mirrors the us-expansion guard). */
export interface TransmitterFlagContext {
  organizationId: string;
  region: 'EU' | 'ME';
}

export interface TransmitResult {
  method: TransmitMethod;
  /** The XSD validation report for the generated XML. */
  validation: IrisValidationReport;
  /**
   * The XSD-validated IRIS XML, present ONLY when validation passed. The manual
   * path returns this for admin download; it is never populated on an INVALID or
   * BUNDLE_UNAVAILABLE report (validity unproven -> do not file).
   */
  xml?: string;
  /** True when the pipeline produced a fileable/downloadable artifact. */
  ready: boolean;
}

export interface TaxFilingTransmitter {
  readonly method: TransmitMethod;
  transmit(input: IrisSubmissionInput): Promise<TransmitResult>;
}

/**
 * Run the shared build+validate pipeline. Returns the validated XML only on a
 * VALID report; an INVALID or BUNDLE_UNAVAILABLE report yields `ready:false` and
 * no XML (validity unproven -> the caller must not file).
 */
async function buildAndValidate(
  input: IrisSubmissionInput,
  method: TransmitMethod,
): Promise<TransmitResult> {
  const xml = buildIrisXml(input);
  const validation = await xsdValidate(xml);

  if (validation.status !== 'VALID') {
    return { method, validation, ready: false };
  }
  return { method, validation, xml, ready: true };
}

/**
 * ManualDownload — the default GA path. Builds + XSD-validates the IRIS XML and,
 * on VALID, returns the buffer for staff to download and upload to IRIS. No TCC
 * required. On an invalid/unavailable report it returns the report without a
 * fileable artifact.
 */
class ManualDownloadTransmitter implements TaxFilingTransmitter {
  readonly method = 'manual' as const;
  transmit(input: IrisSubmissionInput): Promise<TransmitResult> {
    return buildAndValidate(input, this.method);
  }
}

/**
 * IrisA2A — the live automated transmit path. Built but DARK behind
 * `module.iris-efile`: it runs the same build+validate pipeline, but the actual
 * SOAP/MTOM send to the IRIS A2A endpoint is a documented seam that is not wired
 * until IRS TCC/A2A enrollment lands. It never sends while dark.
 */
class IrisA2ATransmitter implements TaxFilingTransmitter {
  readonly method = 'iris-a2a' as const;
  async transmit(input: IrisSubmissionInput): Promise<TransmitResult> {
    // The build+validate is real; the network send is the dark seam. Surface a
    // not-configured signal rather than fabricating a receipt — the manual path
    // is the shipped default until A2A enrollment clears.
    await buildAndValidate(input, this.method);
    log.warn(
      { taxYear: input.taxYear },
      'IRIS A2A transmit requested but the SOAP/MTOM transport is not configured (dark seam)',
    );
    throw new Error('IRIS A2A transport not configured (dark) — use the ManualDownload path.');
  }
}

/** Vendor — a stub seam for a future third-party e-file vendor. Never selected. */
class VendorTransmitter implements TaxFilingTransmitter {
  readonly method = 'vendor' as const;
  transmit(): Promise<TransmitResult> {
    return Promise.reject(new Error('Vendor tax-filing transmitter not configured.'));
  }
}

/**
 * Select the transmitter for the caller's org/region. Returns ManualDownload by
 * default; returns IrisA2A ONLY when `module.iris-efile` is enabled — the single
 * existing dark flag is the gate (no separate A2A-transmit flag is minted).
 */
export function selectTaxFilingTransmitter(flagCtx: TransmitterFlagContext): TaxFilingTransmitter {
  const a2a = evaluate('module.iris-efile', flagCtx);
  if (a2a.enabled) {
    return new IrisA2ATransmitter();
  }
  return new ManualDownloadTransmitter();
}

/** Explicitly construct a transmitter by method (used for the Vendor stub seam). */
export function createTaxFilingTransmitter(method: TransmitMethod): TaxFilingTransmitter {
  switch (method) {
    case 'manual':
      return new ManualDownloadTransmitter();
    case 'iris-a2a':
      return new IrisA2ATransmitter();
    case 'vendor':
      return new VendorTransmitter();
  }
}
