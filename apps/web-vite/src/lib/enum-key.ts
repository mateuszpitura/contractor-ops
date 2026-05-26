/**
 * Convert a DB enum / API value to a camelCase i18n key suffix.
 *
 * Lifted from apps/web/src/lib/enum-key.ts unchanged.
 */

export function enumKey(value: string): string {
  if (!/[._-]/.test(value)) {
    if (/^[A-Z0-9]+$/.test(value)) return value.toLowerCase();
    return value.charAt(0).toLowerCase() + value.slice(1);
  }
  const parts = value.split(/[._-]/).filter(Boolean);
  if (parts.length === 0) return value;
  return parts
    .map((p, i) => {
      const seg = /^[A-Z0-9]+$/.test(p) ? p.toLowerCase() : p;
      if (i === 0) return seg.charAt(0).toLowerCase() + seg.slice(1);
      return seg.charAt(0).toUpperCase() + seg.slice(1);
    })
    .join('');
}
