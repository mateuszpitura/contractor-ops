/**
 * Pure-function export generators for payment run files.
 * Supports CSV (via xlsx), Polish Elixir flat file, SEPA XML pain.001.001.03,
 * SWIFT XML pain.001.001.09, and BACS Standard 18 Direct Credit
 * (UK GBP transfers).
 */

import { createLogger } from '@contractor-ops/logger';
import { minorToDecimalStr, transliterateToBacs } from '@contractor-ops/shared';
import { modulusCheck, VOCALINK_MODULUS_TABLE_V840 } from '@contractor-ops/validators';
import { getPurposeCode } from './purpose-codes';

const log = createLogger({ service: 'payment-export' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportItem = {
  contractorName: string;
  iban: string;
  amountMinor: number;
  currency: string;
  invoiceNumber: string;
  taxId: string | null;
  bankName: string | null;
  swiftBic: string | null;
  dueDate: Date;
  transferTitle: string;
  // SWIFT-specific fields (used for international transfers)
  serviceCategory?: string;
  purposeCodeOverride?: string;
  creditorCountry?: string;
};

export type OrgBankInfo = {
  name: string;
  iban: string;
  bic: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip Polish diacritics to ASCII for bank file compatibility.
 */
export function stripDiacritics(s: string): string {
  const map: Record<string, string> = {
    '\u0105': 'a',
    '\u0107': 'c',
    '\u0119': 'e',
    '\u0142': 'l',
    '\u0144': 'n',
    '\u00f3': 'o',
    '\u015b': 's',
    '\u017a': 'z',
    '\u017c': 'z',
    '\u0104': 'A',
    '\u0106': 'C',
    '\u0118': 'E',
    '\u0141': 'L',
    '\u0143': 'N',
    '\u00d3': 'O',
    '\u015a': 'S',
    '\u0179': 'Z',
    '\u017b': 'Z',
  };
  return s
    .replace(
      /[\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c\u0104\u0106\u0118\u0141\u0143\u00d3\u015a\u0179\u017b]/g,
      ch => map[ch] ?? ch,
    )
    .replace(/[^\x20-\x7E]/g, ''); // Strip any remaining non-ASCII characters
}

/**
 * Format a string into pipe-delimited lines of max lineWidth chars.
 */
export function formatMultiline(s: string, maxLines: number, lineWidth: number): string {
  const clean = stripDiacritics(s);
  const lines: string[] = [];
  let remaining = clean;

  for (let i = 0; i < maxLines && remaining.length > 0; i++) {
    lines.push(remaining.substring(0, lineWidth));
    remaining = remaining.substring(lineWidth);
  }

  return lines.join('|');
}

/**
 * Convert a minor-unit integer to a decimal string using ISO 4217 exponent.
 * Delegates to Dinero.js for currency-aware precision.
 */
function minorToDecimal(minor: number, currency: string = 'PLN'): string {
  return minorToDecimalStr(minor, currency);
}

/**
 * Escape XML special characters.
 */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Resolve a transfer title template with context values.
 * Supported placeholders: {invoice_number}, {billing_period}, {contractor_name}, {contract_number}
 */
export function resolveTransferTitle(
  template: string,
  context: {
    invoiceNumber: string;
    billingPeriod?: string;
    contractorName: string;
    contractNumber?: string;
  },
): string {
  return template
    .replace(/\{invoice_number\}/g, context.invoiceNumber)
    .replace(/\{billing_period\}/g, context.billingPeriod ?? '')
    .replace(/\{contractor_name\}/g, context.contractorName)
    .replace(/\{contract_number\}/g, context.contractNumber ?? '')
    .trim();
}

// ---------------------------------------------------------------------------
// CSV Export (via xlsx library)
// ---------------------------------------------------------------------------

/**
 * Generate a CSV file from payment run items.
 * Uses exceljs for proper escaping and encoding.
 * Adds UTF-8 BOM for Excel compatibility.
 */
export async function generateCsv(items: ExportItem[]): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payment');

  const columns = [
    { header: 'Contractor name', key: 'contractorName' },
    { header: 'IBAN', key: 'iban' },
    { header: 'Amount', key: 'amount' },
    { header: 'Currency', key: 'currency' },
    { header: 'Invoice number', key: 'invoiceNumber' },
    { header: 'NIP', key: 'nip' },
    { header: 'Bank name', key: 'bankName' },
    { header: 'SWIFT/BIC', key: 'swiftBic' },
    { header: 'Due date', key: 'dueDate' },
    { header: 'Transfer title', key: 'transferTitle' },
  ] as const;

  worksheet.columns = columns.map(c => ({ header: c.header, key: c.key }));

  for (const item of items) {
    worksheet.addRow({
      contractorName: item.contractorName,
      iban: item.iban,
      amount: minorToDecimal(item.amountMinor, item.currency),
      currency: item.currency,
      invoiceNumber: item.invoiceNumber,
      nip: item.taxId ?? '',
      bankName: item.bankName ?? '',
      swiftBic: item.swiftBic ?? '',
      dueDate: item.dueDate.toISOString().slice(0, 10),
      transferTitle: item.transferTitle,
    });
  }

  const csvBuffer = Buffer.from(await workbook.csv.writeBuffer());

  // Prepend UTF-8 BOM for Excel compatibility
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  return Buffer.concat([bom, csvBuffer]);
}

// ---------------------------------------------------------------------------
// Elixir (Polish Domestic Transfer) Export
// ---------------------------------------------------------------------------

/**
 * Generate an Elixir type 110 flat file for Polish domestic transfers.
 * Strips diacritics to ASCII for bank compatibility.
 * Lines separated by CRLF.
 */
export function generateElixir(items: ExportItem[], sender: OrgBankInfo): Buffer {
  const lines = items.map(item => {
    const date = formatDateYYYYMMDD(item.dueDate);
    const amountMinor = String(item.amountMinor);
    // Strip "PL" prefix from IBANs — sender and recipient
    const senderAccount = stripCountryPrefix(sender.iban);
    const recipientAccount = stripCountryPrefix(item.iban);
    const senderSort = senderAccount.substring(0, 8);
    const recipientSort = recipientAccount.substring(0, 8);

    const taxId = item.taxId ?? '';
    if (!taxId) {
      log.warn(
        { contractorName: item.contractorName },
        'missing taxId (NIP) for contractor in Elixir export — using empty value',
      );
    }

    return [
      '110',
      date,
      amountMinor,
      senderSort,
      '0',
      `"${senderAccount}"`,
      `"${recipientAccount}"`,
      `"${formatMultiline(sender.name, 4, 35)}"`,
      `"${formatMultiline(item.contractorName, 4, 35)}"`,
      '0',
      recipientSort,
      `"${formatMultiline(item.transferTitle, 4, 35)}"`,
      '""',
      '""',
      `"${taxId ? '1' : ''}"`,
      `"${stripDiacritics(taxId)}"`,
    ].join(',');
  });

  return Buffer.from(lines.join('\r\n'), 'utf-8');
}

// ---------------------------------------------------------------------------
// SEPA XML pain.001.001.03 Export
// ---------------------------------------------------------------------------

/**
 * Generate a SEPA XML pain.001.001.03 credit transfer initiation document.
 */
export function generateSepaXml(items: ExportItem[], org: OrgBankInfo, runNumber: string): Buffer {
  const msgId = runNumber.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 35);
  const now = new Date().toISOString();
  const totalAmount = items.reduce((sum, i) => sum + i.amountMinor, 0);
  const requestedDate =
    items[0]?.dueDate.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  const transactions = items
    .map((item, i) => {
      const endToEndId = `${msgId}-${String(i + 1).padStart(4, '0')}`;
      const bic = item.swiftBic ?? 'NOTPROVIDED';

      return `      <CdtTrfTxInf>
        <PmtId><EndToEndId>${endToEndId}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="${escapeXml(item.currency)}">${minorToDecimal(item.amountMinor, item.currency)}</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>${escapeXml(bic)}</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>${escapeXml(item.contractorName)}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${escapeXml(item.iban)}</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>${escapeXml(item.transferTitle)}</Ustrd></RmtInf>
      </CdtTrfTxInf>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${now}</CreDtTm>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${minorToDecimal(totalAmount, 'EUR')}</CtrlSum>
      <InitgPty><Nm>${escapeXml(org.name)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId.slice(0, 31)}-001</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${minorToDecimal(totalAmount, 'EUR')}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>${requestedDate}</ReqdExctnDt>
      <Dbtr><Nm>${escapeXml(org.name)}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${escapeXml(org.iban)}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>${escapeXml(org.bic)}</BIC></FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>
${transactions}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  return Buffer.from(xml, 'utf-8');
}

// ---------------------------------------------------------------------------
// SWIFT XML pain.001.001.09 Export
// ---------------------------------------------------------------------------

/**
 * Generate a SWIFT XML pain.001.001.09 credit transfer initiation document.
 * Used for international (non-SEPA) transfers — AED, SAR, GBP, and other non-EUR currencies.
 * Sits alongside generateSepaXml; format is chosen by the payment run.
 */
export function generateSwiftXml(items: ExportItem[], org: OrgBankInfo, runNumber: string): Buffer {
  const msgId = runNumber.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 35);
  const now = new Date().toISOString();
  const currency = items[0]?.currency ?? 'USD';
  const totalAmount = items.reduce((sum, i) => sum + i.amountMinor, 0);
  const requestedDate =
    items[0]?.dueDate.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  const transactions = items
    .map((item, i) => {
      const endToEndId = `${msgId}-${String(i + 1).padStart(4, '0')}`;
      const bic = item.swiftBic ?? 'NOTPROVIDED';
      const purposeCode = getPurposeCode(item.serviceCategory ?? '', item.purposeCodeOverride);
      const country = item.creditorCountry ?? '';

      return `      <CdtTrfTxInf>
        <PmtId><EndToEndId>${endToEndId}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="${escapeXml(item.currency)}">${minorToDecimal(item.amountMinor, item.currency)}</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BICFI>${escapeXml(bic)}</BICFI></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>${escapeXml(item.contractorName)}</Nm>${
            country
              ? `
          <PstlAdr><Ctry>${escapeXml(country)}</Ctry></PstlAdr>`
              : ''
          }
        </Cdtr>
        <CdtrAcct><Id><IBAN>${escapeXml(item.iban)}</IBAN></Id></CdtrAcct>
        <Purp><Cd>${purposeCode}</Cd></Purp>
        <RmtInf><Ustrd>${escapeXml(item.transferTitle)}</Ustrd></RmtInf>
      </CdtTrfTxInf>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${now}</CreDtTm>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${minorToDecimal(totalAmount, currency)}</CtrlSum>
      <InitgPty><Nm>${escapeXml(org.name)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId.slice(0, 31)}-001</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${minorToDecimal(totalAmount, currency)}</CtrlSum>
      <ReqdExctnDt><Dt>${requestedDate}</Dt></ReqdExctnDt>
      <Dbtr><Nm>${escapeXml(org.name)}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${escapeXml(org.iban)}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BICFI>${escapeXml(org.bic)}</BICFI></FinInstnId></DbtrAgt>
      <ChrgBr>SHAR</ChrgBr>
${transactions}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  return Buffer.from(xml, 'utf-8');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function stripCountryPrefix(iban: string): string {
  // Remove country code prefix (first 2 letters) if present
  const cleaned = iban.replace(/\s/g, '');
  if (/^[A-Z]{2}/.test(cleaned)) {
    return cleaned.substring(2);
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// BACS Standard 18 Direct Credit
// ---------------------------------------------------------------------------

/**
 * Per-payment input for BACS Std 18 Direct Credit generation.
 * Sort code and account number are decrypted by the caller (the tRPC router)
 * BEFORE invoking the generator — the generator never touches encrypted blobs.
 */
export interface BacsExportItem {
  /** Beneficiary name as it should appear on the bank statement (max 18 BACS-safe ASCII chars after transliteration). */
  contractorName: string;
  /** UK sort code: 6 digits, no hyphens. */
  sortCode: string;
  /** UK account number: 8 digits. */
  accountNumber: string;
  /** Payment amount in pence. Must be < 100_000_000_000 (11-digit pence overflow). */
  amountMinor: number;
  /** Payment reference shown on the recipient's statement (max 18 BACS-safe chars after transliteration). */
  paymentReference: string;
}

/**
 * Submitter (originator) bank details for the BACS file. Configured per
 * organization on the `Settings -> Payments` admin page.
 */
export interface BacsOrgBankInfo {
  /** Service User Number — 6-digit identifier issued by Bacs to the submitting org. */
  serviceUserNumber: string;
  /** Submitter's UK sort code: 6 digits. */
  submitterSortCode: string;
  /** Submitter's UK account number: 8 digits. */
  submitterAccountNumber: string;
  /** Submitter name (max 18 chars BACS-safe ASCII; appears in detail records' originator-name field). */
  submitterName: string;
}

/**
 * Result of {@link generateBacsStandard18}.
 *
 * `transliterationWarnings` and `modulusWarnings` are aggregated for UI
 * display BEFORE the file is downloaded. Modulus-invalid entries
 * warn but do not block (some exception-category sort codes are known-invalid
 * per the VocaLink spec). Per the threat model, the UI MUST block download
 * when any `replaced` entries are present.
 */
export interface BacsGenerateResult {
  fileBuffer: Buffer;
  ext: 'txt';
  transliterationWarnings: Array<{ contractorName: string; replaced: string[] }>;
  modulusWarnings: Array<{ contractorName: string; sortCode: string; warnings: string[] }>;
}

/** Maximum amount in pence representable in 11 digits: 999,999,999.99 GBP. */
const BACS_MAX_AMOUNT_PENCE = 100_000_000_000; // exclusive upper bound

/** Width of BACS detail records (Direct Credit). */
const BACS_DETAIL_RECORD_LEN = 106;

/** Width of BACS label records (VOL1, HDR1, HDR2, UHL1, EOF1, EOF2, UTL1). */
const BACS_LABEL_RECORD_LEN = 80;

/**
 * Convert a date to BACS YYDDD Julian format.
 * - YY = last 2 digits of UTC year, zero-padded
 * - DDD = day-of-year (1-366), zero-padded to 3 digits
 *
 * Uses UTC to avoid timezone-driven drift when the same input date is
 * processed from different regions.
 */
function toJulianDate(date: Date): string {
  const yy = String(date.getUTCFullYear() % 100).padStart(2, '0');
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const ms = date.getTime() - startOfYear;
  const dayOfYear = Math.floor(ms / 86_400_000) + 1;
  const ddd = String(dayOfYear).padStart(3, '0');
  return `${yy}${ddd}`;
}

/**
 * Pad a string to exactly `len` characters with trailing spaces, truncating
 * if longer than `len`.
 */
function padField(value: string, len: number): string {
  return value.padEnd(len, ' ').slice(0, len);
}

/** Pad to exactly `len` characters with leading zeros. Throws if numeric value too large. */
function padZero(value: string, len: number): string {
  return value.padStart(len, '0');
}

/**
 * Transliterate a name/reference to BACS-safe uppercase ASCII, padded/truncated
 * to `len` characters. Returns the formatted field plus the list of unmappable
 * characters that were replaced with `?` so the caller can aggregate warnings.
 */
function bacsField(raw: string, len: number): { field: string; replaced: string[] } {
  const { output, replaced } = transliterateToBacs(raw);
  return { field: padField(output, len), replaced };
}

/**
 * Generate a BACS Standard 18 Direct Credit fixed-width file.
 *
 * File layout (per Pay.UK Standard 18 spec):
 *
 *   VOL1<76 spaces>                      80
 *   HDR1A<SUN><...>                      80
 *   HDR2F0200000100<65 spaces>           80
 *   UHL1<YYDDD><spaces>                  80
 *   <Detail record 1>                   106
 *   ...
 *   <Detail record N>                   106
 *   EOF1A<SUN><spaces>                   80
 *   EOF2F0200000100<spaces>              80
 *   UTL1<total amount, 11 digits>...     80
 *
 * Each detail record (Direct Credit, transaction code '99') has 12 fields
 * totalling exactly 106 chars; see {@link buildDetailRecord}.
 *
 * Lines are joined with CR/LF, no UTF-8 BOM (BACS files are pure ASCII).
 *
 * Throws when any item's `amountMinor` exceeds the 11-digit pence limit.
 */
type BacsTransliterationWarning = BacsGenerateResult['transliterationWarnings'][number];
type BacsModulusWarning = BacsGenerateResult['modulusWarnings'][number];

/**
 * Build one BACS Std 18 detail line for an item plus any per-item warnings.
 * Throws on amount overflow (>11 pence digits) or a detail-length mismatch —
 * both are hard invariants the assembled file must never violate.
 */
function buildBacsDetailLine(
  item: BacsExportItem,
  orgBank: BacsOrgBankInfo,
  originatorNameField: string,
  julian: string,
): {
  detail: string;
  amountMinor: number;
  transliterationWarning?: BacsTransliterationWarning;
  modulusWarning?: BacsModulusWarning;
} {
  if (item.amountMinor < 0 || item.amountMinor >= BACS_MAX_AMOUNT_PENCE) {
    throw new Error(
      `BACS Std 18: amount overflow — amountMinor=${item.amountMinor} exceeds 11-digit pence limit (max ${BACS_MAX_AMOUNT_PENCE - 1})`,
    );
  }

  // Transliterate destination name and aggregate any replacements as warnings.
  const { field: destNameField, replaced: destNameReplaced } = bacsField(item.contractorName, 18);
  const transliterationWarning =
    destNameReplaced.length > 0
      ? { contractorName: item.contractorName, replaced: destNameReplaced }
      : undefined;

  // Transliterate user reference (paymentReference) — no separate warning entry
  // since the contractorName covers the per-item warning surface for UI display.
  const { field: userRefField } = bacsField(item.paymentReference, 18);

  // Modulus check on destination sort code + account.
  const mc = modulusCheck(item.sortCode, item.accountNumber, VOCALINK_MODULUS_TABLE_V840);
  const modulusWarning =
    !mc.valid || mc.warnings.length > 0
      ? {
          contractorName: item.contractorName,
          sortCode: item.sortCode,
          warnings: mc.warnings.length > 0 ? mc.warnings : ['Modulus check failed'],
        }
      : undefined;

  const detail = buildDetailRecord({
    destSortCode: item.sortCode,
    destAccount: item.accountNumber,
    origSortCode: orgBank.submitterSortCode,
    origAccount: orgBank.submitterAccountNumber,
    amountPence: item.amountMinor,
    originatorRef: originatorNameField, // already 18 chars, BACS-safe
    userRef: userRefField, // already 18 chars, BACS-safe
    destName: destNameField, // already 18 chars, BACS-safe
    processingDateJulian: julian,
  });

  if (detail.length !== BACS_DETAIL_RECORD_LEN) {
    // Hard guard — should never trigger if buildDetailRecord is correct.
    throw new Error(
      `BACS Std 18: detail record length mismatch — got ${detail.length}, expected ${BACS_DETAIL_RECORD_LEN}`,
    );
  }

  return { detail, amountMinor: item.amountMinor, transliterationWarning, modulusWarning };
}

export function generateBacsStandard18(
  items: BacsExportItem[],
  orgBank: BacsOrgBankInfo,
  _runRef: string,
  processingDate: Date,
): BacsGenerateResult {
  const julian = toJulianDate(processingDate);
  const transliterationWarnings: BacsGenerateResult['transliterationWarnings'] = [];
  const modulusWarnings: BacsGenerateResult['modulusWarnings'] = [];

  // --- Build originator name field once (same for every detail row) -------
  const { field: originatorNameField, replaced: orgNameReplaced } = bacsField(
    orgBank.submitterName,
    18,
  );
  if (orgNameReplaced.length > 0) {
    transliterationWarnings.push({
      contractorName: orgBank.submitterName,
      replaced: orgNameReplaced,
    });
  }

  // --- Headers ------------------------------------------------------------
  const vol1 = padField('VOL1', BACS_LABEL_RECORD_LEN);
  const hdr1 = padField(
    `HDR1A${orgBank.serviceUserNumber}S  001  001 ${julian} ${julian}000000`,
    BACS_LABEL_RECORD_LEN,
  );
  const hdr2 = padField('HDR2F0200000100', BACS_LABEL_RECORD_LEN);
  const uhl1 = padField(`UHL1${julian}`, BACS_LABEL_RECORD_LEN);

  // --- Detail records -----------------------------------------------------
  let totalAmount = 0;
  const detailLines: string[] = [];

  for (const item of items) {
    const line = buildBacsDetailLine(item, orgBank, originatorNameField, julian);
    totalAmount += line.amountMinor;
    if (line.transliterationWarning) transliterationWarnings.push(line.transliterationWarning);
    if (line.modulusWarning) modulusWarnings.push(line.modulusWarning);
    detailLines.push(line.detail);
  }

  // --- Trailers -----------------------------------------------------------
  const eof1 = padField(`EOF1A${orgBank.serviceUserNumber}`, BACS_LABEL_RECORD_LEN);
  const eof2 = padField('EOF2F0200000100', BACS_LABEL_RECORD_LEN);
  const utl1 = padField(`UTL1${padZero(String(totalAmount), 11)}`, BACS_LABEL_RECORD_LEN);

  // --- Assemble ------------------------------------------------------------
  const allLines = [vol1, hdr1, hdr2, uhl1, ...detailLines, eof1, eof2, utl1];
  const fileBuffer = Buffer.from(allLines.join('\r\n'), 'ascii');

  if (transliterationWarnings.length > 0) {
    log.warn(
      { count: transliterationWarnings.length },
      'BACS Std 18: unmappable characters were replaced with "?" — UI must block download until resolved',
    );
  }
  if (modulusWarnings.length > 0) {
    log.warn(
      { count: modulusWarnings.length },
      'BACS Std 18: modulus check warnings present — review before submission',
    );
  }

  return {
    fileBuffer,
    ext: 'txt',
    transliterationWarnings,
    modulusWarnings,
  };
}

/**
 * Build one BACS Std 18 Direct Credit detail record (exactly 106 chars).
 * Field layout per Pay.UK Standard 18 spec:
 *
 *   Pos 1-6     Destination sort code (6 digits)
 *   Pos 7-14    Destination account number (8 digits)
 *   Pos 15      Type of account (space = default)
 *   Pos 16-17   Transaction code ("99" = Direct Credit)
 *   Pos 18-23   Originator sort code (6 digits)
 *   Pos 24-31   Originator account number (8 digits)
 *   Pos 32-35   Free (4 spaces)
 *   Pos 36-46   Amount in pence (11 digits, zero-padded)
 *   Pos 47-64   Originator name/ref (18 chars, BACS-safe ASCII, space-padded)
 *   Pos 65-82   User reference (18 chars, BACS-safe ASCII, space-padded)
 *   Pos 83-100  Destination account name (18 chars, BACS-safe ASCII, space-padded)
 *   Pos 101-106 Processing date YYDDD Julian (5 chars + 1 space) or 6 spaces
 *
 *   Total: 6 + 8 + 1 + 2 + 6 + 8 + 4 + 11 + 18 + 18 + 18 + 6 = 106
 */
function buildDetailRecord(input: {
  destSortCode: string;
  destAccount: string;
  origSortCode: string;
  origAccount: string;
  amountPence: number;
  /** Already 18 chars BACS-safe. */
  originatorRef: string;
  /** Already 18 chars BACS-safe. */
  userRef: string;
  /** Already 18 chars BACS-safe. */
  destName: string;
  /** YYDDD (5 chars). */
  processingDateJulian: string;
}): string {
  return [
    padField(input.destSortCode, 6),
    padField(input.destAccount, 8),
    ' ', // type of account
    '99', // transaction code: Direct Credit
    padField(input.origSortCode, 6),
    padField(input.origAccount, 8),
    '    ', // free
    padZero(String(input.amountPence), 11),
    input.originatorRef, // 18 chars
    input.userRef, // 18 chars
    input.destName, // 18 chars
    padField(input.processingDateJulian, 6),
  ].join('');
}

// ---------------------------------------------------------------------------
// NACHA ACH Credit File (US)
// ---------------------------------------------------------------------------

/**
 * Per-entry input to {@link generateNachaFile}. Routing and account numbers are
 * decrypted by the caller (the tRPC router) BEFORE the generator runs — the
 * generator never touches encrypted blobs and never logs a full account/routing
 * number.
 */
export interface NachaExportItem {
  /** Receiver individual/company name (truncated to 22 chars for the entry detail). */
  receiverName: string;
  /** RDFI routing/transit number: 8 digits + 1 check digit. */
  routingNumber: string;
  /** Destination DFI account number (up to 17 chars). */
  accountNumber: string;
  /** Credit amount in cents (no decimal point). */
  amountMinor: number;
  /** Receiver individual/company identification reference. */
  individualId: string;
}

/**
 * Originating-DFI (company) file-level details — all hand-set per the ODFI's
 * ACH origination spec, mirroring the hand-set submitter fields BACS Std 18
 * requires.
 */
export interface NachaOrgBankInfo {
  /** Immediate destination — the ODFI routing number the file is sent to (10-position field). */
  immediateDestination: string;
  /** Immediate origin — the company/origin identifier (10-position field). */
  immediateOrigin: string;
  /** Company name shown in the batch header. */
  companyName: string;
  /** Company identification (typically a 10-char EIN-prefixed identifier). */
  companyId: string;
  /** Originating-DFI 8-digit routing prefix used in the trace number + control records. */
  odfiRoutingPrefix: string;
}

/**
 * Result of {@link generateNachaFile}.
 *
 * `warnings` aggregates per-entry name transliteration/truncation notes for UI
 * display before the file is downloaded — mirroring the BACS warnings surface so
 * the caller never silently drops them.
 */
export interface NachaGenerateResult {
  fileBuffer: Buffer;
  ext: 'txt';
  warnings: Array<{ receiverName: string; warnings: string[] }>;
}

/** Every NACHA record (and the all-9 fill records) is exactly 94 characters. */
const NACHA_RECORD_LEN = 94;

/** ACH blocking factor: the physical file is padded to a multiple of 10 records. */
const NACHA_BLOCKING_FACTOR = 10;

/** Max amount in the 10-digit cents field: 99,999,999.99. Exclusive upper bound. */
const NACHA_MAX_AMOUNT_CENTS = 10_000_000_000;

/** Right-justify a numeric identifier into a 10-position field (leading space for a 9-digit routing). */
function nachaTenDigitField(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return ' '.repeat(10 - digits.length) + digits;
}

function nachaDateYYMMDD(date: Date): string {
  const yy = String(date.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function nachaTimeHHMM(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hh}${mi}`;
}

/**
 * Transliterate a name field to ASCII, uppercase, padded/truncated to `len`,
 * returning the formatted field plus any per-entry warning notes (unmappable
 * characters replaced, or truncation of an over-long name).
 */
function nachaNameField(raw: string, len: number): { field: string; warnings: string[] } {
  const warnings: string[] = [];
  const ascii = stripDiacritics(raw).toUpperCase();
  if (ascii.length < raw.length) {
    warnings.push('non-ASCII characters removed from name');
  }
  if (ascii.length > len) {
    warnings.push(`name truncated to ${len} characters`);
  }
  return { field: padField(ascii, len), warnings };
}

function assertNachaLen(record: string, label: string): string {
  if (record.length !== NACHA_RECORD_LEN) {
    // Hard guard — an off-by-one field width makes the operator reject the whole
    // file, so a mismatch must fail loudly rather than ship a malformed record.
    throw new Error(
      `NACHA: ${label} record length mismatch — got ${record.length}, expected ${NACHA_RECORD_LEN}`,
    );
  }
  return record;
}

/**
 * Generate a hand-rolled NACHA ACH credit file (zero dependencies), mirroring
 * the fixed-width / control-total / hard-length-guard shape of
 * {@link generateBacsStandard18}.
 *
 * Record order: 1 file header -> 5 batch header -> 6 entry detail (one per item)
 * -> 8 batch control -> 9 file control, then all-9 fill records padding the file
 * to a multiple of 10 records (blocking factor 10).
 *
 * Defaults to a credits-only batch: service class 220, SEC code PPD (individual
 * payouts; pass CCD for business / CTX with addenda), transaction code 22
 * (checking credit; pass 32 for savings). Numeric fields are right-justified
 * zero-filled; alphanumeric fields are left-justified space-filled.
 *
 * The file is unbalanced credit-only by default (the ODFI funds the offset).
 * Balanced-vs-unbalanced is ODFI-dependent — verify against the org bank's ACH
 * spec before live use.
 *
 * Throws when any item's `amountMinor` exceeds the 10-digit cents field, or when
 * any assembled record is not exactly 94 chars.
 */
export function generateNachaFile(
  items: NachaExportItem[],
  orgBank: NachaOrgBankInfo,
  processingDate: Date = new Date(),
  options: { secCode?: string; transactionCode?: string } = {},
): NachaGenerateResult {
  const secCode = options.secCode ?? 'PPD';
  const transactionCode = options.transactionCode ?? '22';
  const serviceClassCode = '220'; // credits-only batch
  const effectiveDate = nachaDateYYMMDD(processingDate);
  const warnings: NachaGenerateResult['warnings'] = [];

  // --- File Header (1) ----------------------------------------------------
  const fileHeader = assertNachaLen(
    [
      '1',
      '01', // priority code
      nachaTenDigitField(orgBank.immediateDestination),
      nachaTenDigitField(orgBank.immediateOrigin),
      nachaDateYYMMDD(processingDate),
      nachaTimeHHMM(processingDate),
      'A', // file ID modifier
      '094', // record size
      String(NACHA_BLOCKING_FACTOR).padStart(2, '0'),
      '1', // format code
      padField('', 23), // immediate destination name (left blank — receiving bank unknown)
      padField(stripDiacritics(orgBank.companyName).toUpperCase(), 23), // immediate origin name
      padField('', 8), // reference code
    ].join(''),
    'file header',
  );

  // --- Batch Header (5) ---------------------------------------------------
  const batchHeader = assertNachaLen(
    [
      '5',
      serviceClassCode,
      padField(stripDiacritics(orgBank.companyName).toUpperCase(), 16),
      padField('', 20), // company discretionary data
      padField(orgBank.companyId, 10),
      secCode,
      padField('PAYMENT', 10), // company entry description
      effectiveDate, // company descriptive date
      effectiveDate, // effective entry date
      padField('', 3), // settlement date (filled by the ACH operator)
      '1', // originator status code
      padField(orgBank.odfiRoutingPrefix, 8),
      padZero('1', 7), // batch number
    ].join(''),
    'batch header',
  );

  // --- Entry Detail (6) ---------------------------------------------------
  let totalCredit = 0;
  let entryHash = 0;
  const detailLines: string[] = [];

  items.forEach((item, index) => {
    if (item.amountMinor < 0 || item.amountMinor >= NACHA_MAX_AMOUNT_CENTS) {
      throw new Error(
        `NACHA: amount overflow — amountMinor=${item.amountMinor} exceeds the 10-digit cents field (max ${NACHA_MAX_AMOUNT_CENTS - 1})`,
      );
    }

    const routingDigits = item.routingNumber.replace(/\D/g, '');
    const rdfi8 = routingDigits.slice(0, 8);
    const checkDigit = routingDigits.slice(8, 9) || '0';
    entryHash += Number(rdfi8);
    totalCredit += item.amountMinor;

    const { field: nameField, warnings: nameWarnings } = nachaNameField(item.receiverName, 22);
    if (nameWarnings.length > 0) {
      warnings.push({ receiverName: item.receiverName, warnings: nameWarnings });
    }

    const traceNumber = `${padField(orgBank.odfiRoutingPrefix, 8)}${padZero(String(index + 1), 7)}`;

    const detail = assertNachaLen(
      [
        '6',
        transactionCode,
        padField(rdfi8, 8),
        checkDigit,
        padField(item.accountNumber, 17),
        padZero(String(item.amountMinor), 10),
        padField(item.individualId, 15),
        nameField, // 22 chars
        padField('', 2), // discretionary data
        '0', // addenda record indicator (no addenda for PPD/CCD without 7-records)
        traceNumber, // 15 chars
      ].join(''),
      'entry detail',
    );
    detailLines.push(detail);
  });

  const entryHashTrunc = entryHash % NACHA_MAX_AMOUNT_CENTS; // rightmost 10 digits
  const entryCount = items.length;

  // --- Batch Control (8) --------------------------------------------------
  const batchControl = assertNachaLen(
    [
      '8',
      serviceClassCode,
      padZero(String(entryCount), 6),
      padZero(String(entryHashTrunc), 10),
      padZero('0', 12), // total debit
      padZero(String(totalCredit), 12),
      padField(orgBank.companyId, 10),
      padField('', 19), // message authentication code
      padField('', 6), // reserved
      padField(orgBank.odfiRoutingPrefix, 8),
      padZero('1', 7), // batch number
    ].join(''),
    'batch control',
  );

  // --- File Control (9) + 10-record block padding -------------------------
  // Records before fill: file header + batch header + N entries + batch control
  // + file control. Pad with all-9 records to the blocking factor.
  const recordsBeforeFill = 4 + entryCount;
  const fillCount =
    (NACHA_BLOCKING_FACTOR - (recordsBeforeFill % NACHA_BLOCKING_FACTOR)) % NACHA_BLOCKING_FACTOR;
  const blockCount = (recordsBeforeFill + fillCount) / NACHA_BLOCKING_FACTOR;

  const fileControl = assertNachaLen(
    [
      '9',
      padZero('1', 6), // batch count
      padZero(String(blockCount), 6),
      padZero(String(entryCount), 8),
      padZero(String(entryHashTrunc), 10),
      padZero('0', 12), // total debit
      padZero(String(totalCredit), 12),
      padField('', 39), // reserved
    ].join(''),
    'file control',
  );

  const fillRecord = '9'.repeat(NACHA_RECORD_LEN);
  const fillLines = Array.from({ length: fillCount }, () => fillRecord);

  const allLines = [
    fileHeader,
    batchHeader,
    ...detailLines,
    batchControl,
    fileControl,
    ...fillLines,
  ];
  const fileBuffer = Buffer.from(allLines.join('\r\n'), 'ascii');

  if (warnings.length > 0) {
    log.warn(
      { count: warnings.length },
      'NACHA: receiver-name transliteration/truncation warnings present — review before submission',
    );
  }

  return { fileBuffer, ext: 'txt', warnings };
}
