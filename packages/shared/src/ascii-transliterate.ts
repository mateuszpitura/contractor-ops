/**
 * BACS Standard 18 ASCII transliteration utility.
 *
 * Converts arbitrary Unicode input to the BACS Std 18 character set
 * (uppercase A-Z, 0-9, space, plus 14 specific punctuation marks). Common
 * European diacritics are deterministically mapped to ASCII equivalents via
 * {@link TRANSLITERATION_TABLE}. Characters outside the allowed set OR the
 * mapping table are replaced with `?` and reported in the `replaced` array so
 * the UI can warn the user before the file is downloaded.
 *
 * Per Phase 63 D-05.
 */

import { TRANSLITERATION_TABLE } from './ascii-transliterate-table.js';

/**
 * BACS Standard 18 allowed characters: uppercase A-Z, digits 0-9, space, and
 * 14 punctuation marks (- . ' / & ( ) + , : ; ? = " @).
 *
 * Members are stored as a Set for O(1) lookups during transliteration.
 */
const BACS_ALLOWED_CHARS: Set<string> = new Set([
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'0123456789',
  ' ',
  '-',
  '.',
  "'",
  '/',
  '&',
  '(',
  ')',
  '+',
  ',',
  ':',
  ';',
  '?',
  '=',
  '"',
  '@',
]);

export interface TransliterateResult {
  /** The transliterated, BACS-safe uppercase ASCII output string. */
  output: string;
  /**
   * The original characters that could not be mapped to BACS-safe characters.
   * Each occurrence is recorded — duplicates are preserved so callers can
   * count replacements precisely.
   */
  replaced: string[];
}

/**
 * Transliterate `input` to a BACS Std 18-safe uppercase ASCII string.
 *
 * Algorithm (per character):
 *   1. If the character is uppercase A-Z, digits 0-9, space, or BACS
 *      punctuation -> keep as-is.
 *   2. If the character is lowercase a-z -> uppercase, then keep.
 *   3. Else look up the character in {@link TRANSLITERATION_TABLE} -> use the
 *      mapped value (already uppercase).
 *   4. Else look up the lowercase form of the character in the table.
 *   5. Otherwise -> emit `?` and record the original character in `replaced`.
 *
 * Iterates code-points (not UTF-16 code units) so multi-codepoint emoji are
 * handled correctly.
 */
export function transliterateToBacs(input: string): TransliterateResult {
  const replaced: string[] = [];
  let output = '';

  // Iterate by code-points so surrogate-pair emoji are treated as one char.
  for (const char of input) {
    // 1. Already a BACS-allowed character (digit, space, punctuation, or upper letter).
    if (BACS_ALLOWED_CHARS.has(char)) {
      output += char;
      continue;
    }

    // 2. Lowercase ASCII letter — uppercase and emit.
    if (char >= 'a' && char <= 'z') {
      output += char.toUpperCase();
      continue;
    }

    // 3. Direct hit in the transliteration table (covers both cases of common diacritics).
    const direct = TRANSLITERATION_TABLE.get(char);
    if (direct !== undefined) {
      output += direct;
      continue;
    }

    // 4. Lowercase form in the table — covers any case-only-mismatched variant.
    const lower = char.toLowerCase();
    if (lower !== char) {
      const viaLower = TRANSLITERATION_TABLE.get(lower);
      if (viaLower !== undefined) {
        output += viaLower;
        continue;
      }
    }

    // 5. Unmappable — record and emit `?`.
    replaced.push(char);
    output += '?';
  }

  return { output, replaced };
}
