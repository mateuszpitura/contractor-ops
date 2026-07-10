import { DataTable } from '@contractor-ops/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { EwidencjaPeriodRow } from './hooks/use-ewidencja.js';
import { ImmutableBadge } from './immutable-badge.js';
import { SupersedeChainRow } from './supersede-chain-row.js';

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function formatDate(value: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(toIso(value)));
}

function RegenerateButton({
  period,
  onRegenerate,
  isGenerating,
}: {
  period: EwidencjaPeriodRow;
  onRegenerate: (period: EwidencjaPeriodRow) => void;
  isGenerating: boolean;
}) {
  const t = useTranslations('Ewidencja');
  const tc = useTranslations('Ewidencja.regenerateConfirm');
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
            {t('regenerate')}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tc('title')}</AlertDialogTitle>
          <AlertDialogDescription>{tc('description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
          <AlertDialogAction disabled={isGenerating} onClick={() => onRegenerate(period)}>
            {tc('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface EwidencjaSnapshotTableProps {
  periods: EwidencjaPeriodRow[];
  onRegenerate: (period: EwidencjaPeriodRow) => void;
  isGenerating: boolean;
  locale: string;
}

export function EwidencjaSnapshotTable({
  periods,
  onRegenerate,
  isGenerating,
  locale,
}: EwidencjaSnapshotTableProps) {
  const t = useTranslations('Ewidencja');
  const tColumns = useTranslations('Ewidencja.columns');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const columns = useMemo<ColumnDef<EwidencjaPeriodRow>[]>(
    () => [
      {
        id: 'period',
        header: tColumns('period'),
        cell: ({ row }) => {
          const period = row.original;
          const hasChain = period.superseded.length > 0;
          const isOpen = expanded[period.periodKey] ?? false;
          return (
            <div className="flex items-center gap-2">
              {hasChain ? (
                <button
                  type="button"
                  aria-label={t('chainTitle')}
                  aria-expanded={isOpen}
                  onClick={() =>
                    setExpanded(prev => ({ ...prev, [period.periodKey]: !prev[period.periodKey] }))
                  }
                  className="text-muted-foreground hover:text-foreground">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <span className="inline-block w-4" aria-hidden />
              )}
              <span className="text-sm tabular-nums">{period.periodKey}</span>
            </div>
          );
        },
      },
      {
        id: 'version',
        header: tColumns('version'),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {t('versionLabel', { version: row.original.active.version })}
          </span>
        ),
      },
      {
        id: 'status',
        header: tColumns('status'),
        cell: () => <ImmutableBadge />,
      },
      {
        id: 'generated',
        header: tColumns('generated'),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatDate(row.original.active.createdAt, locale)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{tColumns('actions')}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RegenerateButton
              period={row.original}
              onRegenerate={onRegenerate}
              isGenerating={isGenerating}
            />
          </div>
        ),
      },
    ],
    [t, tColumns, locale, expanded, onRegenerate, isGenerating],
  );

  return (
    <DataTable
      columns={columns}
      data={periods}
      totalRows={periods.length}
      entityLabel={t('entityLabel')}
      emptyTitle={t('empty.heading')}
      noResultsTitle={t('empty.heading')}
      clientPagination
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPageChange={setPageIndex}
      onPageSizeChange={setPageSize}
      getRowId={row => row.periodKey}
      expandedRowIds={expanded}
      onExpandedChange={setExpanded}
      renderSubRow={period => {
        if (period.superseded.length === 0) return null;
        const chain = [period.active, ...period.superseded];
        return (
          <div className="space-y-1 py-2 ps-8 pe-4">
            <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
              {t('chainTitle')}
            </p>
            {period.superseded.map((snapshot, index) => (
              <SupersedeChainRow
                key={snapshot.id}
                version={snapshot.version}
                supersededDate={toIso(chain[index].createdAt)}
                locale={locale}
              />
            ))}
          </div>
        );
      }}
    />
  );
}
