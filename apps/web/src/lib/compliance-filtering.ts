/**
 * Client-side health filtering for compliance gaps report.
 */

export interface ComplianceItem {
  health: 'red' | 'yellow' | 'green';
}

const HEALTH_MAP: Record<string, string> = {
  critical: 'red',
  warning: 'yellow',
  ok: 'green',
};

/**
 * Filter compliance items by a health drill-down label.
 *
 * Accepts both canonical labels ("critical", "warning", "ok")
 * and raw health values ("red", "yellow", "green").
 *
 * Returns the original array when drillDownHealth is null/undefined.
 */
export function filterByHealth<T extends ComplianceItem>(
  items: T[],
  drillDownHealth: string | null | undefined,
): T[] {
  if (!drillDownHealth) return items;
  const mapped = HEALTH_MAP[drillDownHealth] ?? drillDownHealth;
  return items.filter(item => item.health === mapped);
}
