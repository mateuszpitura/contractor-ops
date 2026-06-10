/**
 * Shared blog post date formatting for CMS + landing surfaces.
 */
export function formatPostDate(
  publishedAt: string | Date | null | undefined,
  locale: string,
): string {
  if (!publishedAt) return '—';
  const date = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
