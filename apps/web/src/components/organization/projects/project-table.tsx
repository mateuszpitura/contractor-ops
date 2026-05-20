'use client';

import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { SourceBadge } from '@/components/organization/shared/source-badge';
import { StatusBadge } from '@/components/organization/shared/status-badge';
import type { ProjectRow } from './project-form-sheet';

export interface ProjectTableRow extends ProjectRow {
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  source: 'MANUAL' | 'JIRA' | 'LINEAR';
  externalId: string | null;
  updatedAt: Date | string;
}

interface ProjectTableProps {
  rows: ProjectTableRow[];
  teamNamesById: Record<string, string>;
  onRowClick?: (row: ProjectTableRow) => void;
  isLoading?: boolean;
}

const formatBudget = (minor: number | null, currency: string | null): string => {
  if (minor == null || !currency) return '—';
  return `${(minor / 100).toLocaleString(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  })}`;
};

export function ProjectTable({ rows, teamNamesById, onRowClick, isLoading }: ProjectTableProps) {
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
        {t('projectsEmpty')}
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
            <th className="px-3 py-2 font-medium">{t('colTeam')}</th>
            <th className="px-3 py-2 font-medium">{t('colStatus')}</th>
            <th className="px-3 py-2 font-medium">{t('colBudget')}</th>
            <th className="px-3 py-2 font-medium">{t('colSource')}</th>
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
              <td className="px-3 py-2 text-muted-foreground">{row.code ?? '—'}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {row.teamId ? (teamNamesById[row.teamId] ?? row.teamId) : '—'}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-2 tabular-nums text-muted-foreground">
                {formatBudget(row.budgetMinor, row.budgetCurrency)}
              </td>
              <td className="px-3 py-2">
                <SourceBadge source={row.source} />
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
