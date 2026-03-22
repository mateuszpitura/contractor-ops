/**
 * Bank statement parser and matcher for payment run reconciliation.
 * Supports MT940 (via mt940js) and CSV statement formats.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedTransaction {
  /** Absolute value in grosze (integer) */
  amount: number;
  currency: string;
  description: string;
  /** Counterparty IBAN if available */
  iban?: string;
  date: Date;
  reference?: string;
}

export interface MatchResult {
  transactionIndex: number;
  paymentRunItemId: string;
  confidence: "exact" | "partial" | "unmatched";
  amountMatched: boolean;
  ibanMatched: boolean;
}

// ---------------------------------------------------------------------------
// MT940 Parser
// ---------------------------------------------------------------------------

/**
 * Parse an MT940 bank statement using mt940js.
 * Extracts transactions with amounts converted to absolute integer grosze.
 */
export function parseMt940(content: string): ParsedTransaction[] {
  // mt940js uses CommonJS; dynamic import for ESM compatibility
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Parser } = require("mt940js") as {
    Parser: new () => {
      parse: (
        data: string,
      ) => Array<{
        currency?: string;
        transactions: Array<{
          amount: number;
          description?: string;
          date?: Date;
          reference?: string;
          structuredDetails?: {
            accountIdentification?: string;
          };
        }>;
      }>;
    };
  };

  const parser = new Parser();
  const statements = parser.parse(content);

  return statements.flatMap((stmt) =>
    stmt.transactions.map((tx) => ({
      amount: Math.round(Math.abs(tx.amount) * 100),
      currency: stmt.currency ?? "PLN",
      description: tx.description ?? "",
      iban: tx.structuredDetails?.accountIdentification,
      date: tx.date ?? new Date(),
      reference: tx.reference,
    })),
  );
}

// ---------------------------------------------------------------------------
// CSV Statement Parser
// ---------------------------------------------------------------------------

/**
 * Parse a CSV bank statement.
 * Detects columns by header names and handles both dot and comma decimal separators.
 */
export function parseCsvStatement(content: string): ParsedTransaction[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  // Detect delimiter (comma or semicolon)
  const headerLine = lines[0]!;
  const delimiter = headerLine.includes(";") ? ";" : ",";

  const headers = headerLine
    .split(delimiter)
    .map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());

  // Find column indices by common header names
  const amountIdx = headers.findIndex((h) =>
    ["amount", "kwota", "value", "suma"].includes(h),
  );
  const ibanIdx = headers.findIndex((h) =>
    ["iban", "account", "konto", "rachunek", "account number"].includes(h),
  );
  const dateIdx = headers.findIndex((h) =>
    ["date", "data", "booking date", "data operacji"].includes(h),
  );
  const refIdx = headers.findIndex((h) =>
    ["reference", "referencja", "ref"].includes(h),
  );
  const descIdx = headers.findIndex((h) =>
    ["description", "opis", "tytul", "title", "details"].includes(h),
  );

  if (amountIdx === -1) return [];

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!, delimiter);

    const rawAmount = cells[amountIdx]?.replace(/["']/g, "").trim() ?? "0";
    // Handle comma decimal separator (Polish format: "1 234,56")
    const normalizedAmount = rawAmount
      .replace(/\s/g, "")
      .replace(",", ".");
    const amount = Math.round(Math.abs(parseFloat(normalizedAmount)) * 100);

    if (isNaN(amount) || amount === 0) continue;

    const iban =
      ibanIdx >= 0
        ? cells[ibanIdx]?.replace(/["'\s]/g, "").trim()
        : undefined;
    const dateStr =
      dateIdx >= 0
        ? cells[dateIdx]?.replace(/["']/g, "").trim()
        : undefined;
    const reference =
      refIdx >= 0
        ? cells[refIdx]?.replace(/["']/g, "").trim()
        : undefined;
    const description =
      descIdx >= 0
        ? cells[descIdx]?.replace(/["']/g, "").trim() ?? ""
        : "";

    transactions.push({
      amount,
      currency: "PLN",
      description,
      iban: iban || undefined,
      date: dateStr ? new Date(dateStr) : new Date(),
      reference: reference || undefined,
    });
  }

  return transactions;
}

// ---------------------------------------------------------------------------
// Format Detection & Unified Parser
// ---------------------------------------------------------------------------

/**
 * Parse a bank statement by detecting format from filename extension.
 * Supports .mt940 and .csv files.
 */
export function parseBankStatement(
  content: string,
  filename: string,
): ParsedTransaction[] {
  const ext = filename.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "mt940":
    case "sta":
    case "mt9":
      return parseMt940(content);
    case "csv":
    case "txt":
      return parseCsvStatement(content);
    default:
      throw new Error(
        `Unsupported bank statement format: .${ext}. Supported formats: .mt940, .sta, .csv, .txt`,
      );
  }
}

// ---------------------------------------------------------------------------
// Statement-to-Run Matcher
// ---------------------------------------------------------------------------

/**
 * Match bank statement transactions to payment run items by IBAN and amount.
 * Each item is matched at most once.
 * IBAN comparison uses last 20 characters for normalization.
 */
export function matchStatementToRun(
  transactions: ParsedTransaction[],
  items: { id: string; amountGrosze: number; iban: string }[],
): MatchResult[] {
  const results: MatchResult[] = [];
  const matchedItemIds = new Set<string>();

  for (let txIdx = 0; txIdx < transactions.length; txIdx++) {
    const tx = transactions[txIdx]!;
    const txIban = normalizeIban(tx.iban ?? "");

    let bestMatch: {
      itemId: string;
      confidence: "exact" | "partial";
      amountMatched: boolean;
      ibanMatched: boolean;
    } | null = null;

    for (const item of items) {
      if (matchedItemIds.has(item.id)) continue;

      const itemIban = normalizeIban(item.iban);
      const ibanMatched =
        txIban.length >= 10 &&
        itemIban.length >= 10 &&
        txIban.slice(-20) === itemIban.slice(-20);

      const exactAmount = tx.amount === item.amountGrosze;
      const closeAmount = Math.abs(tx.amount - item.amountGrosze) <= 1;

      if (ibanMatched && exactAmount) {
        bestMatch = {
          itemId: item.id,
          confidence: "exact",
          amountMatched: true,
          ibanMatched: true,
        };
        break; // Exact match, no need to search further
      }

      if (ibanMatched && closeAmount) {
        bestMatch = {
          itemId: item.id,
          confidence: "partial",
          amountMatched: false,
          ibanMatched: true,
        };
      } else if (exactAmount && !bestMatch) {
        bestMatch = {
          itemId: item.id,
          confidence: "partial",
          amountMatched: true,
          ibanMatched: false,
        };
      }
    }

    if (bestMatch) {
      matchedItemIds.add(bestMatch.itemId);
      results.push({
        transactionIndex: txIdx,
        paymentRunItemId: bestMatch.itemId,
        ...bestMatch,
      });
    } else {
      results.push({
        transactionIndex: txIdx,
        paymentRunItemId: "",
        confidence: "unmatched",
        amountMatched: false,
        ibanMatched: false,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeIban(iban: string): string {
  return iban.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Simple CSV line splitter that respects quoted fields.
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;

    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  fields.push(current);
  return fields;
}
