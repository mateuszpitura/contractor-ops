import type { ContractStatusInput } from '@contractor-ops/ui';
import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import type { ColumnDef, Row, Table } from '@tanstack/react-table';
import { differenceInDays, isPast } from 'date-fns';
import { memo, useCallback } from 'react';

import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { enumKey } from '../../../lib/enum-key.js';
import { formatMinorUnits } from '../../../lib/format-currency.js';
import { formatDate as coreFormatDate } from '../../../lib/format-date.js';

// ---------------------------------------------------------------------------
// Row type matching the tRPC contract.list response shape
// ---------------------------------------------------------------------------

export type ContractRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  currency: string;
  billingModel: string;
  rateType: string;
  rateValueMinor: number | null;
  complianceRiskLevel: string | null;
  contractor: {
    id: string;
    legalName: string;
    displayName: string | null;
  };
  internalOwner: {
    id: string;
    name: string | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Compliance risk badge styling
// ---------------------------------------------------------------------------

const riskBadgeColors: Record<string, string> = {
  LOW: 'bg-green-500/10 text-green-800 dark:text-green-400',
  MEDIUM: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  HIGH: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

// ---------------------------------------------------------------------------
// Column cell helpers
// ---------------------------------------------------------------------------

function SelectAllHeaderCheckbox({
  table,
  ariaLabel,
}: {
  table: Table<ContractRow>;
  ariaLabel: string;
}) {
  const handleChange = useCallback(
    (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
    [table],
  );
  return (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
      onCheckedChange={handleChange}
      aria-label={ariaLabel}
    />
  );
}

function SelectRowCheckbox({ row, ariaLabel }: { row: Row<ContractRow>; ariaLabel: string }) {
  const handleChange = useCallback(
    (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
    [row],
  );
  return (
    <Checkbox checked={row.getIsSelected()} onCheckedChange={handleChange} aria-label={ariaLabel} />
  );
}

function EndDateTooltipCell({ label, tooltipText }: { label: string; tooltipText: string }) {
  const renderTrigger = useCallback(
    (props: React.HTMLAttributes<HTMLSpanElement>) => (
      <span {...props} className="text-sm cursor-default">
        {label}
      </span>
    ),
    [label],
  );
  return (
    <Tooltip>
      <TooltipTrigger render={renderTrigger} />
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}

const EndDateTooltipCellMemo = memo(EndDateTooltipCell);

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

type TranslateFunction = LooseTranslator;
type DateFormatter = (value: Date | string | null | undefined) => string;

/**
 * Returns all column definitions for the contract data table.
 * Accepts a translation function for headers and labels.
 */
export function getColumns(
  t: TranslateFunction,
  formatDate?: DateFormatter,
): ColumnDef<ContractRow>[] {
  const fmtDate: DateFormatter = formatDate ?? (v => coreFormatDate(v));
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <SelectAllHeaderCheckbox table={table} ariaLabel={t('columns.selectAll')} />
      ),
      cell: ({ row }) => <SelectRowCheckbox row={row} ariaLabel={t('columns.selectRow')} />,
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },

    {
      accessorKey: 'title',
      header: t('columns.title'),
      cell: ({ row }) => (
        <div className="min-w-0 max-w-full">
          <span className="block truncate font-medium" title={row.original.title}>
            {row.original.title}
          </span>
        </div>
      ),
      enableHiding: false,
    },

    {
      id: 'contractor',
      accessorFn: row => row.contractor.displayName ?? row.contractor.legalName,
      header: t('columns.contractor'),
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.contractor.displayName ?? row.original.contractor.legalName}
        </span>
      ),
    },

    {
      accessorKey: 'type',
      header: t('columns.type'),
      cell: ({ row }) => (
        <Badge variant="secondary" className="whitespace-nowrap">
          {tDynLoose(t, 'type', enumKey(row.original.type))}
        </Badge>
      ),
    },

    {
      accessorKey: 'status',
      header: t('columns.status'),
      cell: ({ row }) => {
        const status = row.original.status as ContractStatusInput;
        return (
          <AtelierStatusPill variant={statusToVariant('contract', status)}>
            {tDynLoose(t, 'status', enumKey(status))}
          </AtelierStatusPill>
        );
      },
    },

    {
      accessorKey: 'startDate',
      header: t('columns.startDate'),
      cell: ({ row }) => {
        const startDate = row.original.startDate;
        if (!startDate) return <span className="text-muted-foreground">&mdash;</span>;
        try {
          return <span className="text-sm">{fmtDate(startDate)}</span>;
        } catch {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
      },
    },

    {
      accessorKey: 'endDate',
      header: t('columns.endDate'),
      cell: ({ row }) => {
        const endDate = row.original.endDate;
        if (!endDate) return <span className="text-muted-foreground">&mdash;</span>;
        try {
          const date = new Date(endDate);
          const daysRemaining = differenceInDays(date, new Date());
          const expired = isPast(date);
          const tooltipText = expired
            ? t('daysExpired', { count: Math.abs(daysRemaining) })
            : t('daysRemaining', { count: daysRemaining });

          return <EndDateTooltipCellMemo label={fmtDate(date)} tooltipText={tooltipText} />;
        } catch {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
      },
    },

    {
      accessorKey: 'rateValueMinor',
      header: t('columns.rate'),
      enableSorting: false,
      cell: ({ row }) => {
        const minor = row.original.rateValueMinor;
        if (typeof minor !== 'number')
          return <span className="text-muted-foreground">&mdash;</span>;

        return (
          <span className="font-mono text-sm tabular-nums">
            {formatMinorUnits(minor, null, 'pl-PL')}
          </span>
        );
      },
    },

    {
      accessorKey: 'currency',
      header: t('columns.currency'),
      enableSorting: false,
      cell: ({ row }) => <span className="text-sm">{row.original.currency}</span>,
    },

    {
      accessorKey: 'billingModel',
      header: t('columns.billingCycle'),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm">
          {tDynLoose(t, 'billingModel', enumKey(row.original.billingModel))}
        </span>
      ),
    },

    {
      id: 'internalOwner',
      header: t('columns.owner'),
      cell: ({ row }) => {
        const owner = row.original.internalOwner;
        if (!owner) return <span className="text-muted-foreground">&mdash;</span>;
        return <span className="text-sm">{owner.name ?? owner.id}</span>;
      },
      enableSorting: false,
    },

    {
      accessorKey: 'complianceRiskLevel',
      header: t('columns.complianceRisk'),
      cell: ({ row }) => {
        const risk = row.original.complianceRiskLevel;
        if (!risk) return <span className="text-muted-foreground">&mdash;</span>;
        return (
          <Badge variant="secondary" className={riskBadgeColors[risk] ?? ''}>
            {tDynLoose(t, 'risk', enumKey(risk))}
          </Badge>
        );
      },
      enableSorting: false,
    },
  ];
}
