/**
 * RFC 4180-style CSV generation with UTF-8 BOM for Excel compatibility.
 * Avoids the `xlsx` (SheetJS) package for CSV-only paths.
 */

export const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/**
 * Characters that trigger formula interpretation in common spreadsheet apps
 * (Excel, Numbers, LibreOffice Calc) when they appear as the first character
 * of a cell. Cells starting with any of these are neutralised by prefixing a
 * single quote so the spreadsheet treats the value as literal text.
 *
 * Closes research gap A11 (CSV formula injection — OWASP guidance).
 */
const FORMULA_PREFIXES = new Set(['=', '+', '-', '@']);

/**
 * Escape a single CSV field; quote when needed.
 *
 * Two-step process:
 *   1. Formula-injection neutralisation — if the stringified value starts
 *      with `=`, `+`, `-`, or `@`, prefix with `'` so Excel/Numbers/LibreOffice
 *      treat the cell as text (OWASP; research gap A11).
 *   2. RFC 4180 quoting — if the (post-neutralisation) value contains a
 *      comma, double quote, CR, or LF, wrap in double quotes and double-up
 *      any internal quotes.
 *
 * Applied to every cell value (including numeric) so defence-in-depth
 * protects downstream changes that might add user-entered strings to a
 * column previously holding only numbers.
 */
export function escapeCsvField(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (s.length > 0 && FORMULA_PREFIXES.has(s[0]!)) {
    s = `'${s}`;
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export type CsvColumnKey = { key: string; header: string };

/**
 * Build a CSV buffer: header row + one line per row, CRLF line endings, UTF-8 BOM prefix.
 */
export function encodeCsvUtf8Bom(columns: CsvColumnKey[], rows: Record<string, unknown>[]): Buffer {
  const lines: string[] = [];
  lines.push(columns.map(c => escapeCsvField(c.header)).join(','));
  for (const row of rows) {
    lines.push(columns.map(c => escapeCsvField(row[c.key])).join(','));
  }
  const body = Buffer.from(lines.join('\r\n'), 'utf-8');
  return Buffer.concat([UTF8_BOM, body]);
}
