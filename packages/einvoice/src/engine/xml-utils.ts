// ---------------------------------------------------------------------------
// Shared XML Utilities
// ---------------------------------------------------------------------------

/**
 * Safely navigates a nested object path, returning undefined if any
 * segment is missing. Extracted from KSeF XML parser for reuse.
 */
export function dig(obj: Record<string, unknown>, ...keys: string[]): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Escape a string for safe inclusion in XML element text or
 * double-quoted attribute values, covering the full XML 1.0 §2.4
 * predefined-entity set: `& < > " '`.
 *
 * Use everywhere we hand-build XML fragments (XMP packets, XAdES SignedInfo,
 * etc.) — single source of truth so the escape table cannot drift between
 * sign-time and verify-time canonicalisation (bug-hunt 2026-04-27 [HIGH]).
 */
export function escapeXmlEntities(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Thrown by `toMinorUnits` when the input cannot be parsed as a finite
 * decimal. Distinct from the legacy `parseFloat` behaviour which silently
 * accepted suffixes (`"1190.00 SAR"` → 1190) and returned partial values.
 */
export class InvalidMinorUnitsValueError extends Error {
  readonly code = 'INVALID_MINOR_UNITS_VALUE' as const;
  readonly raw: string;
  constructor(raw: string) {
    super(`Invalid decimal value for minor-units conversion: "${raw}"`);
    this.raw = raw;
    this.name = 'InvalidMinorUnitsValueError';
  }
}

/**
 * Converts a monetary amount (number or numeric string) to minor units
 * (integer). Uses string-splice arithmetic so:
 *   - `"1190.00"` → 119000 exactly (no `parseFloat * 100` rounding error)
 *   - `"1.234"` with `exponent=3` → 1234
 *   - garbage suffixes (`"1190.00 SAR"`) THROW instead of silently accepting
 *     the numeric prefix (which is what the legacy `parseFloat` path did and
 *     is what the bug-hunt 2026-04-27 flagged as `[HIGH]`).
 *
 * Handles missing/undefined values by returning 0 (most callers expect this
 * behaviour for absent XML fields; an explicit empty string is also 0).
 *
 * @param value - The amount to convert
 * @param exponent - Number of decimal places (default 2 for most currencies;
 *                   3 for KWD/BHD/OMR; 0 for JPY).
 * @throws {InvalidMinorUnitsValueError} when the value is non-empty but
 *   cannot be parsed as a finite decimal.
 */
export function toMinorUnits(value: unknown, exponent = 2): number {
  if (value === undefined || value === null || value === '') return 0;
  const str = typeof value === 'string' ? value : String(value);
  const trimmed = str.trim();
  if (trimmed === '') return 0;

  // Strict numeric shape: optional sign, integer part, optional decimal part.
  // Rejects suffixes ("1190 SAR"), spaces inside the number, hex, locale
  // separators (",") — the caller is responsible for normalising those.
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    throw new InvalidMinorUnitsValueError(trimmed);
  }

  const negative = trimmed.startsWith('-');
  const abs = negative ? trimmed.slice(1) : trimmed;
  const [intPartRaw = '0', fracPartRaw = ''] = abs.split('.');
  // Right-pad the fractional part to `exponent` digits, then truncate the
  // overflow. Truncation matches `Math.round(parseFloat(x) * 10**e)` for
  // values where the decimal representation is exact at `exponent` digits;
  // for over-precision we drop additional digits without rounding (callers
  // shipping arithmetic that depends on rounding past `exponent` digits
  // should pre-round).
  const fracPadded = `${fracPartRaw}${'0'.repeat(exponent)}`.slice(0, exponent);
  // Use BigInt to avoid 2^53 overflow on intPartRaw * 10^exponent — the
  // string algorithm preserves precision well past Number.MAX_SAFE_INTEGER.
  const minor = exponent === 0 ? Number(intPartRaw) : Number(`${intPartRaw}${fracPadded}`);
  if (!Number.isFinite(minor)) {
    throw new InvalidMinorUnitsValueError(trimmed);
  }
  return negative ? -minor : minor;
}
