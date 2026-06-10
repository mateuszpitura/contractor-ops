import type { ContractorLifecycleStageInput } from '@contractor-ops/ui';
import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { Avatar, AvatarFallback, AvatarImage } from '@contractor-ops/ui/components/shadcn/avatar';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import type { ColumnDef, Row, Table } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { memo, useCallback } from 'react';
import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { getAvatarInitials } from '../../../lib/avatar-initials.js';
import { enumKey } from '../../../lib/enum-key.js';
import { formatAmount } from '../../../lib/money.js';
import { ComplianceHealthBadge } from '../compliance-health-badge.js';

// ---------------------------------------------------------------------------
// Row type matching the tRPC contractor.list response shape
// ---------------------------------------------------------------------------

export type ContractorRow = {
  id: string;
  legalName: string;
  displayName: string | null;
  type: string;
  status: string;
  lifecycleStage: string;
  currency: string;
  email: string | null;
  taxId: string | null;
  customFieldsJson: Record<string, unknown> | null;
  owner: { id: string; name: string | null; image: string | null } | null;
  primaryTeam: { id: string; name: string } | null;
  billingProfiles: Array<{
    id: string;
    legalEntityName: string | null;
    preferredCurrency: string;
    paymentTermsDays: number | null;
  }>;
  createdAt: string | null;
  updatedAt: string | null;
  complianceHealth: 'green' | 'yellow' | 'red';
};

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

type TranslateFunction = LooseTranslator;

/**
 * Returns all 13 column definitions (select + 12 data columns) for
 * the contractor data table. Accepts a translation function for headers.
 */
export function getColumns(t: TranslateFunction): ColumnDef<ContractorRow>[] {
  return [
    // 1. Select checkbox
    {
      id: 'select',
      header: ({ table }) => <SelectAllCheckbox table={table} ariaLabel={t('columns.selectAll')} />,
      cell: ({ row }) => <SelectRowCheckbox row={row} ariaLabel={t('columns.selectRow')} />,
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },

    // 2. Name / Company
    {
      accessorKey: 'displayName',
      header: t('columns.name'),
      cell: ({ row }) => (
        <div className="min-w-[160px]">
          <div className="font-medium">{row.original.displayName ?? row.original.legalName}</div>
          {!!row.original.displayName && (
            <div className="text-xs text-muted-foreground">{row.original.legalName}</div>
          )}
        </div>
      ),
      enableHiding: false,
    },

    // 3. Type
    {
      accessorKey: 'type',
      header: t('columns.type'),
      cell: ({ row }) => (
        <Badge variant="secondary" className="whitespace-nowrap">
          {tDynLoose(t, 'type', enumKey(row.original.type))}
        </Badge>
      ),
    },

    // 4. Status (lifecycle stage)
    {
      accessorKey: 'lifecycleStage',
      header: t('columns.status'),
      cell: ({ row }) => {
        const stage = row.original.lifecycleStage as ContractorLifecycleStageInput;
        return (
          <AtelierStatusPill variant={statusToVariant('contractor-lifecycle', stage)}>
            {tDynLoose(t, 'lifecycle', enumKey(stage))}
          </AtelierStatusPill>
        );
      },
    },

    // 5. Owner
    {
      accessorKey: 'owner',
      header: t('columns.owner'),
      cell: ({ row }) => {
        const owner = row.original.owner;
        if (!owner) return <span className="text-muted-foreground">&mdash;</span>;
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              {!!owner.image && <AvatarImage src={owner.image} alt="" />}
              <AvatarFallback className="text-[10px]">
                {getAvatarInitials(owner.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{owner.name ?? owner.id}</span>
          </div>
        );
      },
      enableSorting: false,
    },

    // 6. Billing model
    {
      id: 'billingModel',
      header: t('columns.billingModel'),
      cell: ({ row }) => {
        const custom = row.original.customFieldsJson;
        const model =
          typeof custom === 'object' && custom !== null
            ? (custom as Record<string, unknown>).billingModel
            : null;
        return model ? (
          <span className="text-sm">{tDynLoose(t, 'billingModel', enumKey(String(model)))}</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        );
      },
    },

    // 7. Rate
    {
      id: 'rate',
      header: t('columns.rate'),
      cell: ({ row }) => {
        const custom = row.original.customFieldsJson;
        const minor =
          typeof custom === 'object' && custom !== null
            ? (custom as Record<string, unknown>).rateValueMinor
            : null;
        if (typeof minor !== 'number')
          return <span className="text-muted-foreground">&mdash;</span>;

        return (
          <span className="font-mono text-sm tabular-nums">
            {formatAmount(minor, row.original.currency, 'pl-PL')}
          </span>
        );
      },
    },

    // 8. Currency
    {
      accessorKey: 'currency',
      header: t('columns.currency'),
      cell: ({ row }) => <span className="text-sm">{row.original.currency}</span>,
    },

    // 9. Next invoice expected (placeholder)
    {
      id: 'nextInvoice',
      header: t('columns.nextInvoice'),
      cell: () => <span className="text-muted-foreground">&mdash;</span>,
      enableSorting: false,
    },

    // 10. Team / Project
    {
      id: 'teamProject',
      header: t('columns.teamProject'),
      cell: ({ row }) => {
        const team = row.original.primaryTeam;
        return team ? (
          <span className="text-sm">{team.name}</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        );
      },
      enableSorting: false,
    },

    // 11. Contract end date (placeholder)
    {
      id: 'contractEnd',
      header: t('columns.contractEnd'),
      cell: () => <span className="text-muted-foreground">&mdash;</span>,
      enableSorting: false,
    },

    // 12. Last activity
    {
      id: 'lastActivity',
      header: t('columns.lastActivity'),
      cell: ({ row }) => {
        const updatedAt = row.original.updatedAt;
        if (!updatedAt) return <span className="text-muted-foreground">&mdash;</span>;
        try {
          return (
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
            </span>
          );
        } catch {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
      },
      enableSorting: false,
    },

    // 13. Compliance health
    {
      accessorKey: 'complianceHealth',
      header: t('columns.health'),
      cell: ({ row }) => <ComplianceHealthBadge health={row.original.complianceHealth} />,
      enableSorting: false,
    },
  ];
}

interface SelectAllCheckboxProps {
  table: Table<ContractorRow>;
  ariaLabel: string;
}

const SelectAllCheckbox = memo(function SelectAllCheckbox({
  table,
  ariaLabel,
}: SelectAllCheckboxProps) {
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
});

interface SelectRowCheckboxProps {
  row: Row<ContractorRow>;
  ariaLabel: string;
}

const SelectRowCheckbox = memo(function SelectRowCheckbox({
  row,
  ariaLabel,
}: SelectRowCheckboxProps) {
  const handleChange = useCallback(
    (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
    [row],
  );
  return (
    <Checkbox checked={row.getIsSelected()} onCheckedChange={handleChange} aria-label={ariaLabel} />
  );
});
