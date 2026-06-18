// IRIS 1099-NEC XML generator.
//
// Built with fast-xml-parser's XMLBuilder (never string-concatenated XML —
// entity-escape bugs surface as opaque XSD failures), mirroring
// packages/einvoice. The Transmission Manifest carries the schema
// VersionNum/VersionDt the submission was built against (per TY2025 the
// version lives in the payload manifest, not the message metadata), and each
// payee B-record carries the Combined Federal/State Filing (CFSF) state code.
//
// ADVISER-VERIFY: element names + USAmountType formatting are pending the
// pinned IRS IRIS XSD bundle (src/schema-bundle). See types.ts.

import { XMLBuilder } from 'fast-xml-parser';
import type { IrisPayee, IrisSubmissionInput } from './types.js';

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  format: true,
  suppressBooleanAttributes: false,
});

/**
 * IRIS USAmountType is a non-negative whole-dollar integer. Convert minor
 * units (cents) to the dollar figure the schema expects.
 */
function toUsAmount(minorUnits: number): number {
  return Math.round(minorUnits / 100);
}

/** Build a single payee B-record group. */
function buildPayeeRecord(payee: IrisPayee): Record<string, unknown> {
  return {
    // `recipientTin` is the masked last-4 value supplied by the caller — the
    // full recipient SSN/TIN is never reconstructed or emitted here.
    RecipientTIN: payee.recipientTin,
    RecipientName: payee.recipientName,
    Box1NonemployeeCompensationAmt: toUsAmount(payee.box1AmountMinor),
    Box4FederalTaxWithheldAmt: toUsAmount(payee.box4BackupWithholdingMinor),
    // Combined Federal/State Filing — the participating state's code for
    // this B-record.
    CFSFStateCd: payee.cfsfStateCode,
  };
}

/**
 * Generate an IRIS 1099-NEC XML submission string from canonical input.
 *
 * @returns Well-formed IRIS XML (UTF-8 string). Validate it with
 *   {@link xsdValidate} before transmission.
 */
export function buildIrisXml(input: IrisSubmissionInput): string {
  const doc = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    Form1099NECSubmission: {
      TransmissionManifest: {
        TaxYr: input.taxYear,
        // The schema version the payload is built against (payload-manifest,
        // not message metadata — re-verified per tax year).
        VersionNum: input.schemaVersion.versionNum,
        VersionDt: input.schemaVersion.versionDt,
      },
      Payer: {
        PayerTIN: input.payer.tin,
        PayerName: input.payer.name,
        PayerStateCd: input.payer.stateCode,
      },
      PayeeRecordGrp: input.payees.map(buildPayeeRecord),
    },
  };

  return builder.build(doc);
}
