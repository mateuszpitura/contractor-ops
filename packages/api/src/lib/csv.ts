/**
 * CSV generation helpers — both an eager (legacy) buffer builder and a
 * streaming variant for the async export framework.
 *
 * Why streaming matters
 * ---------------------
 * The legacy `encodeCsvUtf8Bom` materialises every row as a string and then
 * concatenates them — for a 100k-row export that is ~25 MB heap allocated
 * on the request path, which compounds with the 1.3× base64 amplification
 * if the response is shipped over JSON. Combined with the async export
 * async export framework we now stream rows from a Prisma cursor through
 * `csv-stringify` and pipe directly into an R2 multipart upload — peak
 * heap usage is bounded by the stream's high-water mark (~64 KB) regardless
 * of result size.
 *
 * RFC 4180 + UTF-8 BOM (Excel) + formula-injection neutralisation are
 * preserved across both code paths.
 */

import { Readable } from 'node:stream';
import type { Stringifier } from 'csv-stringify';
import { stringify } from 'csv-stringify';

export const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/**
 * Characters that trigger formula interpretation in common spreadsheet apps
 * (Excel, Numbers, LibreOffice Calc) when they appear as the first character
 * of a cell. Cells starting with any of these are neutralised by prefixing a
 * single quote so the spreadsheet treats the value as literal text.
 *
 * Closes CSV formula injection risk (OWASP guidance).
 */
const FORMULA_PREFIXES = new Set(['=', '+', '-', '@']);

/**
 * Escape a single CSV field; quote when needed.
 *
 * Two-step process:
 *   1. Formula-injection neutralisation — if the stringified value starts
 *      with `=`, `+`, `-`, or `@`, prefix with `'` so Excel/Numbers/LibreOffice
 *      treat the cell as text (OWASP CSV injection guidance).
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
  const first = s[0];
  if (first !== undefined && FORMULA_PREFIXES.has(first)) {
    s = `'${s}`;
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Same neutralisation applied at the streaming layer — `csv-stringify`
 * handles RFC 4180 quoting natively, but we still need to defang formula
 * prefixes before it sees the value.
 */
function neutralizeFormulaPrefix(value: unknown): string | number | boolean | null | undefined {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const s = String(value);
  const first = s[0];
  if (first !== undefined && FORMULA_PREFIXES.has(first)) {
    return `'${s}`;
  }
  return s;
}

export type CsvColumnKey = { key: string; header: string };

/**
 * Build a CSV buffer: header row + one line per row, CRLF line endings,
 * UTF-8 BOM prefix.
 *
 * Kept for backwards compatibility with paths that build small (<1 MB)
 * CSV payloads inline. New large/unbounded exports MUST use
 * {@link streamCsvResponse} via the async export framework.
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

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

export interface StreamCsvOptions {
  /** Column definitions in display order. */
  columns: CsvColumnKey[];
  /**
   * Async iterable of row objects keyed by `columns[].key`. Typically a
   * Prisma cursor stream wrapped in an `async function*` generator, but
   * any AsyncIterable works (arrays via `Symbol.asyncIterator`, etc.).
   */
  rows: AsyncIterable<Record<string, unknown>>;
  /**
   * Whether to prefix the stream with a UTF-8 BOM so Excel reads Polish/
   * German diacritics correctly. Defaults to `true` for parity with the
   * legacy buffer encoder.
   */
  withBom?: boolean;
}

/**
 * Stream rows as CSV bytes. Returns a Node `Readable` ready to pipe into
 * an R2 multipart upload, an HTTP response, or any other Writable.
 *
 * Memory characteristics: O(largest single row) — the underlying
 * `csv-stringify` Stringifier transforms one row at a time and the
 * generator pulls rows lazily. Combined with Prisma cursor pagination
 * (`{ cursor, take: 500 }`) the entire export uses bounded heap.
 *
 * The stream propagates errors from the row iterable to the consumer via
 * `destroy(err)` — pipe consumers must wire `.on('error', ...)` to surface
 * upload failures cleanly.
 */
export function streamCsvResponse(opts: StreamCsvOptions): Readable {
  const { columns, rows, withBom = true } = opts;

  // csv-stringify writes header automatically when `header: true` and
  // `columns` is provided as `{ key, header }[]`.
  const stringifier: Stringifier = stringify({
    header: true,
    columns: columns.map(c => ({ key: c.key, header: c.header })),
    // CRLF for Excel-friendliness, matching the legacy encoder.
    record_delimiter: '\r\n',
    // We pre-neutralise formula prefixes before handing the row to the
    // stringifier; csv-stringify's own quoting handles RFC 4180 escaping.
    quoted: false,
    // Allow null/undefined cells without throwing — they emit empty fields.
    quoted_empty: false,
  });

  // Prepend the BOM by writing it to a passthrough that pipes the
  // stringifier output. We use `Readable.from(...)` of a generator that
  // yields BOM (once) then drains the stringifier's chunks.
  async function* compose(): AsyncGenerator<Buffer | string> {
    if (withBom) yield UTF8_BOM;

    // Pump rows into the stringifier asynchronously; the generator below
    // yields stringifier output chunks as they become available.
    let pumpError: Error | null = null;
    const pump = (async () => {
      try {
        for await (const row of rows) {
          // Neutralise per-cell formula prefixes before handing to csv-stringify.
          const sanitised: Record<string, unknown> = {};
          for (const col of columns) {
            sanitised[col.key] = neutralizeFormulaPrefix(row[col.key]);
          }
          // Backpressure: write returns false when the high-water mark is
          // exceeded; await `drain` to resume.
          if (!stringifier.write(sanitised)) {
            await new Promise<void>(resolve => stringifier.once('drain', () => resolve()));
          }
        }
        stringifier.end();
      } catch (err) {
        pumpError = err instanceof Error ? err : new Error(String(err));
        stringifier.destroy(pumpError);
      }
    })();

    for await (const chunk of stringifier) {
      yield chunk as Buffer;
    }
    await pump;
    if (pumpError) throw pumpError;
  }

  return Readable.from(compose());
}

/**
 * Convenience: collect a streaming CSV into a single Buffer. Used by tests
 * and by callers that still need an in-memory artefact (e.g. when the
 * destination is the small inline-attachment path). Prefer piping
 * {@link streamCsvResponse} directly into R2 for unbounded exports.
 */
export async function collectStreamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf-8') : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}
