/**
 * Convert a DB enum / API value to a camelCase i18n key suffix.
 *
 * Idempotent for values that contain no `_` or `-` separators —
 * `'documentCollection'` returns unchanged, `'DOCUMENT_COLLECTION'` and
 * `'document_collection'` both return `'documentCollection'`.
 */
export function enumKey(value: string): string {
  if (!/[_-]/.test(value)) {
    if (/^[A-Z0-9]+$/.test(value)) return value.toLowerCase();
    return value.charAt(0).toLowerCase() + value.slice(1);
  }
  const parts = value.toLowerCase().split(/[_-]/).filter(Boolean);
  if (parts.length === 0) return value;
  return parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}
