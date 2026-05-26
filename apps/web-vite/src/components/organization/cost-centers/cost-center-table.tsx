/**
 * Cost centers table — Step 10 batch 6 / Step 11 codemod port from
 * apps/web/src/components/organization/cost-centers/cost-center-table.tsx:
 *   - `next-intl` → `../../../i18n/useTranslations.js`
 */

import { format } from 'date-fns';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { StatusBadge } from '../shared/status-badge.js';
import type { CostCenterRow } from './cost-center-form-sheet.js';

export interface CostCenterTableRow extends CostCenterRow {
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  updatedAt: Date | string;
}

interface CostCenterTableProps {
  rows: CostCenterTableRow[];
  onRowClick?: (row: CostCenterTableRow) => void;
  isLoading?: boolean;
}

export function CostCenterTable({ rows, onRowClick, isLoading }: CostCenterTableProps) {
  const t = useTranslations('Organization');
  if (isLoading) {
    return (
      <div className="text-muted-foreground py-12 text-center text-sm" aria-busy>
        Loading…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
        {t('costCentersEmpty')}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-muted-foreground text-left">
            <th className="px-3 py-2 font-medium">{t('colName')}</th>
            <th className="px-3 py-2 font-medium">{t('colCode')}</th>
            <th className="px-3 py-2 font-medium">{t('colStatus')}</th>
            <th className="px-3 py-2 font-medium">{t('colUpdated')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.id}
              className="hover:bg-muted/30 cursor-pointer border-t transition-colors"
              onClick={() => onRowClick?.(row)}
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick?.(row);
                }
              }}>
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2 font-mono uppercase">{row.code}</td>
              <td className="px-3 py-2">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-2 text-muted-foreground tabular-nums">
                {format(new Date(row.updatedAt), 'yyyy-MM-dd')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
