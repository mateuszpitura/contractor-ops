/**
 * Bank statement parser and matcher for payment run reconciliation.
 * Supports MT940 (via mt940js) and CSV statement formats.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedTransaction {
  /** Absolute value in minor units (integer) */
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
  confidence: 'exact' | 'partial' | 'unmatched';
  amountMatched: boolean;
  ibanMatched: boolean;
}

// ---------------------------------------------------------------------------
// MT940 Parser
// ---------------------------------------------------------------------------

/**
 * Parse an MT940 bank statement using mt940js.
 * Extracts transactions with amounts converted to absolute integer minor units.
 */
export function parseMt940(content: string): ParsedTransaction[] {
  // mt940js uses CommonJS; dynamic import for ESM compatibility
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Parser } = require('mt940js') as {
    Parser: new () => {
      parse: (data: string) => Array<{
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

  return statements.flatMap(stmt =>
    stmt.transactions.map(tx => ({
      amount: Math.round(Math.abs(tx.amount) * 100),
      currency: stmt.currency ?? 'PLN',
      description: tx.description ?? '',
      iban: tx.structuredDetails?.accountIdentification,
      date: tx.date ?? new Date(),
      reference: tx.reference,
    })),
  );
}

// ---------------------------------------------------------------------------
// CSV Statement Parser
// ---------------------------------------------------------------------------

/** Column name aliases for CSV header detection. */
const CSV_COLUMN_ALIASES: Record<string, string[]> = {
  amount: ['amount', 'kwota', 'value', 'suma'],
  iban: ['iban', 'account', 'konto', 'rachunek', 'account number'],
  date: ['date', 'data', 'booking date', 'data operacji'],
  reference: ['reference', 'referencja', 'ref'],
  description: ['description', 'opis', 'tytul', 'title', 'details'],
};

/**
 * Detects column indices from normalized CSV headers using alias matching.
 */
function detectCsvColumns(headers: string[]): Record<string, number> {
  const indices: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(CSV_COLUMN_ALIASES)) {
    indices[field] = headers.findIndex(h => aliases.includes(h));
  }
  return indices;
}

/**
 * Parses a raw amount string (supporting comma decimals and spaces) into minor units.
 */
function parseAmountMinor(raw: string): number {
  const cleaned = raw.replace(/["']/g, '').trim().replace(/\s/g, '').replace(',', '.');
  return Math.round(Math.abs(parseFloat(cleaned)) * 100);
}

/**
 * Parse a CSV bank statement.
 * Detects columns by header names and handles both dot and comma decimal separators.
 */
export function parseCsvStatement(content: string): ParsedTransaction[] {
  const lines = content
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) return [];

  const headerLine = lines[0] ?? '';
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const headers = headerLine.split(delimiter).map(h =>
    h
      .replace(/^["']|["']$/g, '')
      .trim()
      .toLowerCase(),
  );

  const col = detectCsvColumns(headers);
  if (col.amount === -1) return [];

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i] ?? '', delimiter);
    const amount = parseAmountMinor(cells[col.amount] ?? '0');
    if (Number.isNaN(amount) || amount === 0) continue;

    const iban = col.iban >= 0 ? cells[col.iban]?.replace(/["'\s]/g, '').trim() : undefined;
    const dateStr = col.date >= 0 ? cells[col.date]?.replace(/["']/g, '').trim() : undefined;
    const reference =
      col.reference >= 0 ? cells[col.reference]?.replace(/["']/g, '').trim() : undefined;
    const description =
      col.description >= 0 ? (cells[col.description]?.replace(/["']/g, '').trim() ?? '') : '';

    transactions.push({
      amount,
      currency: 'PLN',
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
export function parseBankStatement(content: string, filename: string): ParsedTransaction[] {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'mt940':
    case 'sta':
    case 'mt9':
      return parseMt940(content);
    case 'csv':
    case 'txt':
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
 * Scores a single transaction against a single payment run item.
 * Returns null if no match, or a match descriptor with confidence level.
 */
function scoreTransactionItem(
  txAmount: number,
  txIban: string,
  item: { id: string; amountMinor: number; iban: string },
): {
  itemId: string;
  confidence: 'exact' | 'partial';
  amountMatched: boolean;
  ibanMatched: boolean;
} | null {
  const itemIban = normalizeIban(item.iban);
  const ibanMatched =
    txIban.length >= 10 && itemIban.length >= 10 && txIban.slice(-20) === itemIban.slice(-20);

  const exactAmount = txAmount === item.amountMinor;
  const closeAmount = Math.abs(txAmount - item.amountMinor) <= 1;

  if (ibanMatched && exactAmount) {
    return { itemId: item.id, confidence: 'exact', amountMatched: true, ibanMatched: true };
  }
  if (ibanMatched && closeAmount) {
    return { itemId: item.id, confidence: 'partial', amountMatched: false, ibanMatched: true };
  }
  if (exactAmount) {
    return { itemId: item.id, confidence: 'partial', amountMatched: true, ibanMatched: false };
  }
  return null;
}

/**
 * Finds the best matching item for a transaction from a list of unmatched items.
 */
function findBestMatch(
  txAmount: number,
  txIban: string,
  items: { id: string; amountMinor: number; iban: string }[],
  matchedItemIds: Set<string>,
): {
  itemId: string;
  confidence: 'exact' | 'partial';
  amountMatched: boolean;
  ibanMatched: boolean;
} | null {
  let bestMatch: ReturnType<typeof scoreTransactionItem> = null;

  for (const item of items) {
    if (matchedItemIds.has(item.id)) continue;

    const scored = scoreTransactionItem(txAmount, txIban, item);
    if (!scored) continue;

    // Exact match — return immediately
    if (scored.confidence === 'exact') return scored;

    // Keep first partial match (IBAN-based takes precedence over amount-only)
    if (!bestMatch || (scored.ibanMatched && !bestMatch.ibanMatched)) {
      bestMatch = scored;
    }
  }

  return bestMatch;
}

/**
 * Match bank statement transactions to payment run items by IBAN and amount.
 * Each item is matched at most once.
 * IBAN comparison uses last 20 characters for normalization.
 */
export function matchStatementToRun(
  transactions: ParsedTransaction[],
  items: { id: string; amountMinor: number; iban: string }[],
): MatchResult[] {
  const results: MatchResult[] = [];
  const matchedItemIds = new Set<string>();

  for (let txIdx = 0; txIdx < transactions.length; txIdx++) {
    const tx = transactions[txIdx];
    if (!tx) continue;

    const txIban = normalizeIban(tx.iban ?? '');
    const bestMatch = findBestMatch(tx.amount, txIban, items, matchedItemIds);

    if (bestMatch) {
      matchedItemIds.add(bestMatch.itemId);
      results.push({ transactionIndex: txIdx, paymentRunItemId: bestMatch.itemId, ...bestMatch });
    } else {
      results.push({
        transactionIndex: txIdx,
        paymentRunItemId: '',
        confidence: 'unmatched',
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
  return iban.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Simple CSV line splitter that respects quoted fields.
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  fields.push(current);
  return fields;
}
