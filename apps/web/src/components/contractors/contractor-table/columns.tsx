'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { getAvatarInitials } from '@/lib/avatar-initials';
import { enumKey } from '@/lib/enum-key';
import { ComplianceHealthBadge } from '../compliance-health-badge';

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
// Lifecycle stage badge styling
// ---------------------------------------------------------------------------

const lifecycleBadgeColors: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border border-border',
  ONBOARDING: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  ACTIVE: 'bg-green-500/10 text-green-600 dark:text-green-400',
  OFFBOARDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  ENDED: 'bg-muted text-muted-foreground border border-border',
};

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

type TranslateFunction = (key: string) => string;

/**
 * Returns all 13 column definitions (select + 12 data columns) for
 * the contractor data table. Accepts a translation function for headers.
 */
export function getColumns(t: TranslateFunction): ColumnDef<ContractorRow>[] {
  return [
    // 1. Select checkbox
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          // biome-ignore lint/nursery/noJsxPropsBind: column definition
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('columns.selectAll')}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          // biome-ignore lint/nursery/noJsxPropsBind: column definition
          onCheckedChange={value => row.toggleSelected(!!value)}
          aria-label={t('columns.selectRow')}
          // biome-ignore lint/nursery/noJsxPropsBind: column definition
          onClick={e => e.stopPropagation()}
        />
      ),
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
          {t(`type.${enumKey(row.original.type)}`)}
        </Badge>
      ),
    },

    // 4. Status (lifecycle stage)
    {
      accessorKey: 'lifecycleStage',
      header: t('columns.status'),
      cell: ({ row }) => {
        const stage = row.original.lifecycleStage;
        return (
          <Badge variant="secondary" className={lifecycleBadgeColors[stage] ?? ''}>
            {t(`lifecycle.${enumKey(stage)}`)}
          </Badge>
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
          <span className="text-sm">{t(`billingModel.${enumKey(String(model))}`)}</span>
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

        const formatted = new Intl.NumberFormat('pl-PL', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(minor / 100);

        return (
          <span className="font-mono text-sm tabular-nums">
            {formatted} {row.original.currency}
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
