/**
 * Format a date as a human-readable relative string (today / yesterday / Xd ago).
 * Falls back to a locale-formatted date string for dates older than 30 days.
 *
 * @param dateStr  Date or ISO date string to format
 * @param locale   BCP 47 locale tag for the fallback date format (default: "en")
 */
export function formatRelativeDate(dateStr: Date | string, locale: string = 'en'): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 1) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString(locale);
}
