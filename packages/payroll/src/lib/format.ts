// Shared, format-agnostic helpers for the payroll export generators. Kept pure
// so every profile stays golden-testable.

import type { PayrollFeedEmployee } from '../types/feed.js';

/** Read a country field as a string (empty string when absent/null). */
export function cf(employee: PayrollFeedEmployee, key: string): string {
  const value = employee.countryFields[key];
  return value == null ? '' : String(value);
}

/** Escape the five XML special characters. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Split a `displayName` into surname (last whitespace-delimited token) and the
 * remaining first name(s). Payroll vendors overwhelmingly key on surname +
 * first name, while the feed carries a single display name.
 */
export function splitName(displayName: string): { firstNames: string; surname: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstNames: '', surname: parts[0] ?? '' };
  }
  const surname = parts[parts.length - 1];
  return { firstNames: parts.slice(0, -1).join(' '), surname };
}

/** Normalize an ISO date/datetime string to its `YYYY-MM-DD` date part. */
export function isoDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

/** Compact an ISO date to `YYYYMMDD` (fixed-width statutory layouts). */
export function compactDate(value: string | null | undefined): string {
  return isoDate(value).replace(/-/g, '');
}

/** German transliteration for ASCII-only fixed-width targets (DATEV). */
const DE_TRANSLITERATION = new Map<string, string>([
  ['ä', 'ae'],
  ['ö', 'oe'],
  ['ü', 'ue'],
  ['Ä', 'Ae'],
  ['Ö', 'Oe'],
  ['Ü', 'Ue'],
  ['ß', 'ss'],
]);

export function transliterateDe(s: string): string {
  return s.replace(/[äöüÄÖÜß]/g, c => DE_TRANSLITERATION.get(c) ?? c).replace(/[^\x20-\x7E]/g, '');
}
