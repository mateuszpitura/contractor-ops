// ---------------------------------------------------------------------------
// E-Invoice Pipeline
// ---------------------------------------------------------------------------

import type { EInvoice } from "../types/invoice.js";
import type { CertificateInfo, EInvoiceProfile } from "../types/profile.js";
import type { ValidationResult } from "../types/validation.js";

/**
 * Result of running an invoice through the engine pipeline.
 */
export interface PipelineResult {
  /** Generated XML (unsigned) */
  xml: string;
  /** Validation result */
  validation: ValidationResult;
  /** Signed XML (null if profile doesn't support signing or no certificate provided) */
  signedXml: string | null;
  /** QR code data (null if profile doesn't support QR codes) */
  qrData: Buffer | null;
  /** Profile that processed this invoice */
  profileId: string;
  /** Steps that were executed in order */
  stepsExecuted: string[];
}

/**
 * Options for controlling pipeline behavior.
 */
export interface PipelineOptions {
  /** Certificate for signing (required if profile supports signing) */
  certificate?: CertificateInfo;
  /** Skip validation step */
  skipValidation?: boolean;
  /** Skip signing even if profile supports it */
  skipSign?: boolean;
  /** Skip QR code generation even if profile supports it */
  skipQR?: boolean;
}

/**
 * Run an invoice through the engine pipeline:
 * generate → validate → sign → QR code
 *
 * The pipeline respects profile capabilities:
 * - If profile.sign is undefined, signing is skipped
 * - If profile.qrCode is undefined, QR generation is skipped
 * - If validation fails, signing and QR are NOT attempted
 *
 * Per D-07: the engine orchestrates the pipeline; profiles provide
 * country-specific implementations.
 */
export async function runPipeline(
  profile: EInvoiceProfile,
  invoice: EInvoice,
  options?: PipelineOptions,
): Promise<PipelineResult> {
  const stepsExecuted: string[] = [];

  // Step 1: Generate XML
  const xml = await profile.generate(invoice);
  stepsExecuted.push("generate");

  // Step 2: Validate (unless skipped)
  let validation: ValidationResult;
  if (options?.skipValidation) {
    validation = {
      valid: true,
      errors: [],
      warnings: [],
      profileId: profile.profileId,
    };
  } else {
    validation = await profile.validate(xml);
    stepsExecuted.push("validate");
  }

  // If validation fails, stop pipeline — do not sign invalid XML
  if (!validation.valid) {
    return {
      xml,
      validation,
      signedXml: null,
      qrData: null,
      profileId: profile.profileId,
      stepsExecuted,
    };
  }

  // Step 3: Sign (if profile supports it and not skipped)
  let signedXml: string | null = null;
  if (profile.sign && !options?.skipSign) {
    if (!options?.certificate) {
      validation.warnings.push({
        code: "SIGN_SKIPPED",
        message: "Profile supports signing but no certificate provided",
        severity: "warning",
      });
    } else {
      signedXml = await profile.sign.sign(xml, options.certificate);
      stepsExecuted.push("sign");
    }
  }

  // Step 4: QR code (if profile supports it and not skipped)
  let qrData: Buffer | null = null;
  if (profile.qrCode && !options?.skipQR) {
    qrData = await profile.qrCode.generateQR(invoice);
    stepsExecuted.push("qrCode");
  }

  return {
    xml,
    validation,
    signedXml,
    qrData,
    profileId: profile.profileId,
    stepsExecuted,
  };
}
