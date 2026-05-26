/**
 * Client-side compliance health filtering. Lifted from
 * apps/web/src/lib/compliance-filtering.ts unchanged.
 */

export interface ComplianceItem {
  health: 'red' | 'yellow' | 'green';
}

const HEALTH_MAP: Record<string, string> = {
  critical: 'red',
  warning: 'yellow',
  ok: 'green',
};

export function filterByHealth<T extends ComplianceItem>(
  items: T[],
  drillDownHealth: string | null | undefined,
): T[] {
  if (!drillDownHealth) return items;
  const mapped = HEALTH_MAP[drillDownHealth] ?? drillDownHealth;
  return items.filter(item => item.health === mapped);
}
