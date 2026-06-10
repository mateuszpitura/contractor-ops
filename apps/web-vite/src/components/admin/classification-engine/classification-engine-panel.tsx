import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ClassificationEngineRow } from '../hooks/use-admin-classification-engine.js';

export function ClassificationEnginePanelHeader() {
  const t = useTranslations('Admin.ClassificationEngineFlag');
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t('moduleName')}</h1>
      <p className="mt-1 text-muted-foreground">{t('killSwitchDesc')}</p>
    </div>
  );
}

interface FlagStatusCardProps {
  flagEnabled: boolean;
}

export function FlagStatusCard({ flagEnabled }: FlagStatusCardProps) {
  const t = useTranslations('Admin.ClassificationEngineFlag');
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t('appSideValue')}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {flagEnabled ? (
          <>
            <CheckCircle className="h-5 w-5 text-green-600" aria-hidden />
            <span className="font-semibold text-green-800">{t('statusEnabled')}</span>
          </>
        ) : (
          <>
            <XCircle className="h-5 w-5 text-red-600" aria-hidden />
            <span className="font-semibold text-red-700">{t('statusDisabled')}</span>
          </>
        )}
      </div>
    </div>
  );
}

interface RegistryStatusCardProps {
  pendingCount: number;
  totalCount: number;
}

export function RegistryStatusCard({ pendingCount, totalCount }: RegistryStatusCardProps) {
  const t = useTranslations('Admin.ClassificationEngineFlag');
  const allApproved = pendingCount === 0;
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t('signoffRegistry')}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {allApproved ? (
          <>
            <CheckCircle className="h-5 w-5 text-green-600" aria-hidden />
            <span className="font-semibold text-green-800">
              {t('allApprovedCount', { count: totalCount })}
            </span>
          </>
        ) : (
          <>
            <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden />
            <span className="font-semibold text-amber-700">
              {t('pendingOfTotal', { pending: pendingCount, total: totalCount })}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

interface OverrideBannerProps {
  pendingCount: number;
}

export function ClassificationOverrideBanner({ pendingCount }: OverrideBannerProps) {
  const t = useTranslations('Admin.ClassificationEngineFlag');
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">
        {t('pendingGate', { count: pendingCount })}
      </p>
      <p className="mt-1 text-xs text-amber-700">
        {t('pendingGateResolution')} <code className="font-mono">{t('registryPath')}</code>{' '}
        {t('pendingGateDetail')}
      </p>
    </div>
  );
}

interface DisclaimerRegistryTableProps {
  rows: ClassificationEngineRow[];
}

export function DisclaimerRegistryTable({ rows }: DisclaimerRegistryTableProps) {
  const t = useTranslations('Admin.ClassificationEngineFlag');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const columns = useMemo<ColumnDef<ClassificationEngineRow, unknown>[]>(
    () => [
      {
        id: 'key',
        accessorKey: 'key',
        header: t('colDisclaimerKey'),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.key}</span>,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.isPending ? 'destructive' : 'default'}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: 'approvedBy',
        accessorKey: 'approvedBy',
        header: t('colApprovedBy'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.approvedBy ?? '—'}</span>
        ),
      },
      {
        id: 'approvedAt',
        accessorKey: 'approvedAt',
        header: t('colApprovedAt'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.approvedAt
              ? new Date(row.original.approvedAt).toLocaleDateString('en-GB')
              : '—'}
          </span>
        ),
      },
      {
        id: 'approverRole',
        accessorKey: 'approverRole',
        header: t('colApproverRole'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.approverRole ?? '—'}</span>
        ),
      },
    ],
    [t],
  );

  return (
    <div>
      <h2 className="text-lg font-semibold">{t('disclaimerRegistryTitle')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('allKeysMustBeApproved')}</p>
      <div className="mt-4">
        <WorkbenchDataTable
          sectionClassName=""
          columns={columns}
          data={rows}
          totalRows={rows.length}
          clientPagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={setPageIndex}
          onPageSizeChange={size => {
            setPageSize(size);
            setPageIndex(0);
          }}
          constrainHeight={false}
          hideDensityToggle
          hideChrome
          getRowId={row => row.key}
          entityLabel={t('disclaimerRegistryTitle')}
          emptyTitle={t('disclaimerRegistryTitle')}
          noResultsTitle={t('disclaimerRegistryTitle')}
        />
      </div>
    </div>
  );
}
