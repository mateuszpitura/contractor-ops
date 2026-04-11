// ---------------------------------------------------------------------------
// Shared XML Utilities
// ---------------------------------------------------------------------------

/**
 * Safely navigates a nested object path, returning undefined if any
 * segment is missing. Extracted from KSeF XML parser for reuse.
 */
export function dig(
  obj: Record<string, unknown>,
  ...keys: string[]
): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Converts a monetary amount (float or string) to minor units (integer).
 * Handles missing/undefined values by returning 0.
 *
 * @param value - The amount to convert
 * @param exponent - Number of decimal places (default 2 for most currencies).
 *                   Future-proofed for ISO 4217 lookup in Phase 46.
 */
export function toMinorUnits(value: unknown, exponent = 2): number {
  if (value === undefined || value === null || value === "") return 0;
  const factor = Math.pow(10, exponent);
  return Math.round(parseFloat(String(value)) * factor);
}
