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
import type {
  Iris1042SRecipient,
  Iris1042SSubmissionInput,
  IrisPayee,
  IrisSubmissionInput,
} from './types.js';

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
 * IRIS withholding-rate elements carry a percentage with two decimals; convert
 * basis points (`1500`) to that string form (`'15.00'`).
 */
function toRatePercent(basisPoints: number): string {
  return (basisPoints / 100).toFixed(2);
}

/**
 * Build a single 1042-S recipient record group.
 *
 * The full foreign TIN is never reconstructed — only the masked last-4
 * `recipientFtin` supplied by the caller reaches the payload.
 */
function build1042SRecipientRecord(recipient: Iris1042SRecipient): Record<string, unknown> {
  return {
    RecipientFTIN: recipient.recipientFtin,
    RecipientName: recipient.recipientName,
    IncomeCd: recipient.incomeCode,
    GrossIncomeBox2Amt: toUsAmount(recipient.grossIncomeBox2Minor),
    Chap3ExemptionCd: recipient.chap3ExemptionCode,
    Chap3WithholdingRt: toRatePercent(recipient.chap3RateBp),
    Chap4ExemptionCd: recipient.chap4ExemptionCode,
    Chap4WithholdingRt: toRatePercent(recipient.chap4RateBp),
    FederalTaxWithheldBox7Amt: toUsAmount(recipient.federalTaxWithheldBox7Minor),
    RecipientChap3StatusCd: recipient.recipientChap3StatusCode,
    RecipientChap4StatusCd: recipient.recipientChap4StatusCode,
    RecipientLOBCd: recipient.recipientLobCode,
    TreatyArticleTxt: recipient.treatyArticle,
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

/**
 * Generate an IRIS 1042-S XML submission string from canonical input.
 *
 * A sibling of {@link buildIrisXml} rather than a parameterised 1099 builder:
 * the 1042-S (Publication 1187) record layout differs materially — chapter 3/4
 * status/exemption codes, income codes, and treaty fields — so it gets its own
 * recipient record while sharing the Transmission Manifest shape and the
 * XMLBuilder (never string-concatenated XML — entity-escape bugs surface as
 * opaque XSD failures).
 *
 * @returns Well-formed IRIS XML (UTF-8 string). Validate it with
 *   {@link xsdValidate1042S} before transmission.
 */
export function buildIris1042SXml(input: Iris1042SSubmissionInput): string {
  const doc = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    Form1042SSubmission: {
      TransmissionManifest: {
        TaxYr: input.taxYear,
        VersionNum: input.schemaVersion.versionNum,
        VersionDt: input.schemaVersion.versionDt,
      },
      WithholdingAgent: {
        WithholdingAgentTIN: input.withholdingAgent.tin,
        WithholdingAgentName: input.withholdingAgent.name,
      },
      RecipientRecordGrp: input.recipients.map(build1042SRecipientRecord),
    },
  };

  return builder.build(doc);
}
