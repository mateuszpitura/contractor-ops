/**
 * RFC 4180-style CSV generation with UTF-8 BOM for Excel compatibility.
 * Avoids the `xlsx` (SheetJS) package for CSV-only paths.
 */

export const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/**
 * Escape a single CSV field; quote when needed.
 */
export function escapeCsvField(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
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
  lines.push(columns.map((c) => escapeCsvField(c.header)).join(","));
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvField(row[c.key])).join(","));
  }
  const body = Buffer.from(lines.join("\r\n"), "utf-8");
  return Buffer.concat([UTF8_BOM, body]);
}
