import type { AtelierEmptyStateAction } from '@contractor-ops/ui';
import {
  AtelierEmptyState,
  ContractsIllustration,
  DataTable,
  SectionLabel,
} from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import type { ColumnDef } from '@tanstack/react-table';
import { FileText, Plus } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useRouter } from '../../../i18n/navigation.js';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { formatAmount } from '../../../lib/money.js';
import { ContractWizardDialog } from '../../contracts/contract-wizard/wizard-dialog.js';
import type { ContractorTabContractRow } from '../hooks/use-contractor-tab-contracts.js';
import { useContractorTabContracts } from '../hooks/use-contractor-tab-contracts.js';

const noopPageSizeChange = () => undefined;

const statusBadgeColors: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border border-border',
  PENDING_SIGNATURE: 'bg-muted text-muted-foreground border border-border',
  ACTIVE: 'bg-green-500/10 text-green-800 dark:text-green-400',
  EXPIRING: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  EXPIRED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  TERMINATED: 'bg-muted text-muted-foreground border border-border',
  SUPERSEDED: 'bg-muted/50 text-muted-foreground/60 border border-border/50',
  ARCHIVED: 'bg-muted text-muted-foreground border border-border',
};

type TabContractsViewProps = {
  contractorId: string;
} & ReturnType<typeof useContractorTabContracts>;

export type TabContractsEmptyProps = Pick<
  TabContractsViewProps,
  'contractorId' | 'wizardOpen' | 'setWizardOpen'
>;

function renderEmptyStateAction(action: AtelierEmptyStateAction, variant: 'primary' | 'secondary') {
  const Icon = action.icon;
  return (
    <Button variant={variant === 'secondary' ? 'outline' : 'default'} onClick={action.onClick}>
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {action.label}
    </Button>
  );
}

export function TabContractsEmpty({
  contractorId,
  wizardOpen,
  setWizardOpen,
}: TabContractsEmptyProps) {
  const t = useTranslations('Contracts');
  const handleOpenWizard = useCallback(() => setWizardOpen(true), [setWizardOpen]);
  const primaryAction = useMemo(
    () => ({
      label: t('contractorTab.emptyCTA'),
      onClick: handleOpenWizard,
      icon: Plus,
    }),
    [t, handleOpenWizard],
  );
  return (
    <>
      <AtelierEmptyState
        variant="subview"
        illustration={ContractsIllustration}
        heading={t('contractorTab.emptyHeading')}
        body={t('contractorTab.emptyBody')}
        primaryAction={primaryAction}
        renderAction={renderEmptyStateAction}
      />
      <ContractWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        contractorId={contractorId}
      />
    </>
  );
}

export function TabContractsView({
  contractorId,
  wizardOpen,
  setWizardOpen,
  page,
  setPage,
  pageSize,
  items,
  totalCount,
  totalPages,
  isLoading,
}: TabContractsViewProps) {
  const t = useTranslations('Contracts');
  const { formatDate } = useDateFormatter();
  const router = useRouter();

  const columns: ColumnDef<ContractorTabContractRow>[] = useMemo(
    () => [
      {
        accessorKey: 'title',
        header: t('contractorTab.columns.title'),
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        accessorKey: 'status',
        header: t('contractorTab.columns.status'),
        cell: ({ row }) => (
          <Badge variant="secondary" className={statusBadgeColors[row.original.status] ?? ''}>
            {tDynLoose(t, 'status', enumKey(row.original.status))}
          </Badge>
        ),
      },
      {
        accessorKey: 'startDate',
        header: t('contractorTab.columns.startDate'),
        cell: ({ row }) => {
          if (!row.original.startDate)
            return <span className="text-muted-foreground">&mdash;</span>;
          try {
            return <span className="text-sm">{formatDate(row.original.startDate)}</span>;
          } catch {
            return <span className="text-muted-foreground">&mdash;</span>;
          }
        },
      },
      {
        accessorKey: 'endDate',
        header: t('contractorTab.columns.endDate'),
        cell: ({ row }) => {
          if (!row.original.endDate) return <span className="text-muted-foreground">&mdash;</span>;
          try {
            return <span className="text-sm">{formatDate(row.original.endDate)}</span>;
          } catch {
            return <span className="text-muted-foreground">&mdash;</span>;
          }
        },
      },
      {
        accessorKey: 'rateValueMinor',
        header: t('contractorTab.columns.rate'),
        cell: ({ row }) => {
          const minor = row.original.rateValueMinor;
          if (typeof minor !== 'number')
            return <span className="text-muted-foreground">&mdash;</span>;
          return (
            <span className="font-mono text-sm tabular-nums">
              {formatAmount(minor, row.original.currency, 'pl-PL')}
            </span>
          );
        },
      },
    ],
    [t, formatDate],
  );

  const handleOpenWizard = useCallback(() => setWizardOpen(true), [setWizardOpen]);
  const handleRowClick = useCallback(
    (row: ContractorTabContractRow) => router.push(`/contracts/${row.id}`),
    [router],
  );
  const handlePageChange = useCallback(
    (nextIndex: number) => setPage(Math.max(1, Math.min(totalPages, nextIndex + 1))),
    [setPage, totalPages],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SectionLabel icon={FileText}>{t('contractorTab.heading')}</SectionLabel>
        </div>
        <Button size="sm" disabled={isLoading} onClick={handleOpenWizard}>
          <Plus className="me-1.5 size-3.5" />
          {t('contractorTab.addCTA')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        totalRows={totalCount}
        pageIndex={Math.max(0, page - 1)}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={noopPageSizeChange}
        isLoading={isLoading}
        constrainHeight={false}
        hideDensityToggle
        entityLabel={t('entityLabel', { count: totalCount })}
        emptyTitle={t('contractorTab.emptyHeading')}
        emptyDescription={t('contractorTab.emptyBody')}
        noResultsTitle={t('contractorTab.emptyHeading')}
        skeletonRows={5}
        onRowClick={handleRowClick}
      />

      <ContractWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        contractorId={contractorId}
      />
    </div>
  );
}

type TabContractsContainerProps = {
  contractorId: string;
};

export function TabContractsContainer({ contractorId }: TabContractsContainerProps) {
  const contracts = useContractorTabContracts(contractorId);

  if (!contracts.isLoading && contracts.items.length === 0) {
    return (
      <TabContractsEmpty
        contractorId={contracts.contractorId}
        wizardOpen={contracts.wizardOpen}
        setWizardOpen={contracts.setWizardOpen}
      />
    );
  }

  return <TabContractsView {...contracts} />;
}

/** @deprecated Use TabContracts */
export { TabContractsContainer as TabContracts };
