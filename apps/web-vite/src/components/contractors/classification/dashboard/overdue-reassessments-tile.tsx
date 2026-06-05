/**
 * Overdue reassessments tile.
 */

import { useTranslations } from '../../../../i18n/useTranslations.js';

export interface OverdueItem {
  contractorAssignmentId: string;
  contractorName: string;
  reason: string;
}

export interface OverdueReassessmentsTileProps {
  count: number;
  items: OverdueItem[];
}

export function OverdueReassessmentsTile({ count, items }: OverdueReassessmentsTileProps) {
  const t = useTranslations('Classification.polish.dashboard');

  return (
    <div className="flex flex-col gap-2" data-testid="overdue-reassessments-tile">
      <h3 className="text-sm font-medium text-foreground">{t('overdueTitle')}</h3>
      <div className="flex items-baseline gap-2">
        <span
          className={`text-3xl font-semibold tabular-nums ${count > 0 ? 'text-[--warning]' : 'text-foreground'}`}>
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="text-sm text-muted-foreground">{t('overdueEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {items.slice(0, 5).map(item => (
            <li key={item.contractorAssignmentId} className="truncate">
              {item.contractorName || item.contractorAssignmentId}
            </li>
          ))}
          {count > 5 ? (
            <li className="text-xs text-primary">{t('overdueShowMore', { count: count - 5 })}</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
