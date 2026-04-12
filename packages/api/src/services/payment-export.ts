/**
 * Pure-function export generators for payment run files.
 * Supports CSV (via xlsx), Polish Elixir flat file, SEPA XML pain.001.001.03,
 * and SWIFT XML pain.001.001.09 (Phase 46).
 */

import { minorToDecimalStr } from "@contractor-ops/shared";
import { getPurposeCode } from "./purpose-codes.js";

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
  // SWIFT-specific (added in Phase 46)
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
    "\u0105": "a",
    "\u0107": "c",
    "\u0119": "e",
    "\u0142": "l",
    "\u0144": "n",
    "\u00f3": "o",
    "\u015b": "s",
    "\u017a": "z",
    "\u017c": "z",
    "\u0104": "A",
    "\u0106": "C",
    "\u0118": "E",
    "\u0141": "L",
    "\u0143": "N",
    "\u00d3": "O",
    "\u015a": "S",
    "\u0179": "Z",
    "\u017b": "Z",
  };
  return s
    .replace(
      /[\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c\u0104\u0106\u0118\u0141\u0143\u00d3\u015a\u0179\u017b]/g,
      (ch) => map[ch] ?? ch,
    )
    .replace(/[^\x20-\x7E]/g, ""); // Strip any remaining non-ASCII characters
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

  return lines.join("|");
}

/**
 * Convert a minor-unit integer to a decimal string using ISO 4217 exponent.
 * Delegates to Dinero.js for currency-aware precision (per D-02).
 */
function minorToDecimal(minor: number, currency: string = "PLN"): string {
  return minorToDecimalStr(minor, currency);
}

/**
 * Escape XML special characters.
 */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
    .replace(/\{billing_period\}/g, context.billingPeriod ?? "")
    .replace(/\{contractor_name\}/g, context.contractorName)
    .replace(/\{contract_number\}/g, context.contractNumber ?? "")
    .trim();
}

// ---------------------------------------------------------------------------
// CSV Export (via xlsx library)
// ---------------------------------------------------------------------------

/**
 * Generate a CSV file from payment run items.
 * Uses xlsx library for proper escaping and encoding.
 * Adds UTF-8 BOM for Excel compatibility.
 */
export async function generateCsv(items: ExportItem[]): Promise<Buffer> {
  const { default: XLSX } = await import("xlsx");

  const rows = items.map((item) => ({
    "Contractor name": item.contractorName,
    IBAN: item.iban,
    Amount: minorToDecimal(item.amountMinor, item.currency),
    Currency: item.currency,
    "Invoice number": item.invoiceNumber,
    NIP: item.taxId ?? "",
    "Bank name": item.bankName ?? "",
    "SWIFT/BIC": item.swiftBic ?? "",
    "Due date": item.dueDate.toISOString().slice(0, 10),
    "Transfer title": item.transferTitle,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Payment");

  const csvBuffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "csv",
  }) as Buffer;

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
  const lines = items.map((item) => {
    const date = formatDateYYYYMMDD(item.dueDate);
    const amountMinor = String(item.amountMinor);
    // Strip "PL" prefix from IBANs — sender and recipient
    const senderAccount = stripCountryPrefix(sender.iban);
    const recipientAccount = stripCountryPrefix(item.iban);
    const senderSort = senderAccount.substring(0, 8);
    const recipientSort = recipientAccount.substring(0, 8);

    const taxId = item.taxId ?? "";
    if (!taxId) {
      console.warn(
        `[payment-export] Missing taxId (NIP) for contractor "${item.contractorName}" in Elixir export — using empty value`,
      );
    }

    return [
      "110",
      date,
      amountMinor,
      senderSort,
      "0",
      `"${senderAccount}"`,
      `"${recipientAccount}"`,
      `"${formatMultiline(sender.name, 4, 35)}"`,
      `"${formatMultiline(item.contractorName, 4, 35)}"`,
      "0",
      recipientSort,
      `"${formatMultiline(item.transferTitle, 4, 35)}"`,
      '""',
      '""',
      `"${taxId ? "1" : ""}"`,
      `"${stripDiacritics(taxId)}"`,
    ].join(",");
  });

  return Buffer.from(lines.join("\r\n"), "utf-8");
}

// ---------------------------------------------------------------------------
// SEPA XML pain.001.001.03 Export
// ---------------------------------------------------------------------------

/**
 * Generate a SEPA XML pain.001.001.03 credit transfer initiation document.
 */
export function generateSepaXml(items: ExportItem[], org: OrgBankInfo, runNumber: string): Buffer {
  const msgId = runNumber.replace(/[^a-zA-Z0-9-]/g, "").substring(0, 35);
  const now = new Date().toISOString();
  const totalAmount = items.reduce((sum, i) => sum + i.amountMinor, 0);
  const requestedDate =
    items[0]?.dueDate.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  const transactions = items
    .map((item, i) => {
      const endToEndId = `${msgId}-${String(i + 1).padStart(4, "0")}`;
      const bic = item.swiftBic ?? "NOTPROVIDED";

      return `      <CdtTrfTxInf>
        <PmtId><EndToEndId>${endToEndId}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="${escapeXml(item.currency)}">${minorToDecimal(item.amountMinor, item.currency)}</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BIC>${escapeXml(bic)}</BIC></FinInstnId></CdtrAgt>
        <Cdtr><Nm>${escapeXml(item.contractorName)}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${escapeXml(item.iban)}</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>${escapeXml(item.transferTitle)}</Ustrd></RmtInf>
      </CdtTrfTxInf>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${now}</CreDtTm>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${minorToDecimal(totalAmount, "EUR")}</CtrlSum>
      <InitgPty><Nm>${escapeXml(org.name)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId.slice(0, 31)}-001</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${minorToDecimal(totalAmount, "EUR")}</CtrlSum>
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

  return Buffer.from(xml, "utf-8");
}

// ---------------------------------------------------------------------------
// SWIFT XML pain.001.001.09 Export (Phase 46)
// ---------------------------------------------------------------------------

/**
 * Generate a SWIFT XML pain.001.001.09 credit transfer initiation document.
 * Used for international (non-SEPA) transfers — AED, SAR, GBP, and other non-EUR currencies.
 * Per D-03: sits alongside generateSepaXml, format chosen by payment run.
 */
export function generateSwiftXml(items: ExportItem[], org: OrgBankInfo, runNumber: string): Buffer {
  const msgId = runNumber.replace(/[^a-zA-Z0-9-]/g, "").substring(0, 35);
  const now = new Date().toISOString();
  const currency = items[0]?.currency ?? "USD";
  const totalAmount = items.reduce((sum, i) => sum + i.amountMinor, 0);
  const requestedDate =
    items[0]?.dueDate.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  const transactions = items
    .map((item, i) => {
      const endToEndId = `${msgId}-${String(i + 1).padStart(4, "0")}`;
      const bic = item.swiftBic ?? "NOTPROVIDED";
      const purposeCode = getPurposeCode(item.serviceCategory ?? "", item.purposeCodeOverride);
      const country = item.creditorCountry ?? "";

      return `      <CdtTrfTxInf>
        <PmtId><EndToEndId>${endToEndId}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="${escapeXml(item.currency)}">${minorToDecimal(item.amountMinor, item.currency)}</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BICFI>${escapeXml(bic)}</BICFI></FinInstnId></CdtrAgt>
        <Cdtr>
          <Nm>${escapeXml(item.contractorName)}</Nm>${
            country
              ? `
          <PstlAdr><Ctry>${escapeXml(country)}</Ctry></PstlAdr>`
              : ""
          }
        </Cdtr>
        <CdtrAcct><Id><IBAN>${escapeXml(item.iban)}</IBAN></Id></CdtrAcct>
        <Purp><Cd>${purposeCode}</Cd></Purp>
        <RmtInf><Ustrd>${escapeXml(item.transferTitle)}</Ustrd></RmtInf>
      </CdtTrfTxInf>`;
    })
    .join("\n");

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

  return Buffer.from(xml, "utf-8");
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function stripCountryPrefix(iban: string): string {
  // Remove country code prefix (first 2 letters) if present
  const cleaned = iban.replace(/\s/g, "");
  if (/^[A-Z]{2}/.test(cleaned)) {
    return cleaned.substring(2);
  }
  return cleaned;
}
