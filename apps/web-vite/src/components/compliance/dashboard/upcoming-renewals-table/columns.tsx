import type { ColumnDef } from '@tanstack/react-table';

import { Link } from '../../../../i18n/navigation.js';
import type { LooseTranslator } from '../../../../i18n/typed-keys.js';
import { useDateFormatter } from '../../../../lib/format/use-date-formatter.js';
import { useComplDocName } from '../../hooks/use-compl-doc-name.js';
import type { UpcomingRow } from '../hooks/use-compliance-dashboard.js';

function complianceItemHref(contractorId: string, itemId: string): string {
  return `/contractors/${contractorId}/compliance#item-${itemId}`;
}

function DocNameCell({ policyRuleId }: { policyRuleId: string | null }) {
  const { label, isPending } = useComplDocName(policyRuleId);
  return (
    <span className="text-sm">
      {label}
      {isPending && (
        <sup className="ml-0.5 text-muted-foreground" aria-hidden>
          †
        </sup>
      )}
    </span>
  );
}

function ExpiresAtCell({ expiresAt }: { expiresAt: Date | string | null }) {
  const { formatDate } = useDateFormatter();
  if (!expiresAt) return <span className="text-muted-foreground">&mdash;</span>;
  return <span className="text-sm tabular-nums">{formatDate(new Date(expiresAt))}</span>;
}

function daysUntil(expiresAt: Date | string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function getUpcomingRenewalsColumns(t: LooseTranslator): ColumnDef<UpcomingRow>[] {
  return [
    {
      id: 'contractor',
      accessorFn: row => row.contractor?.displayName ?? row.contractor?.legalName ?? '',
      header: t('columns.contractor'),
      cell: ({ row }) => {
        const r = row.original;
        const name = r.contractor?.displayName ?? r.contractor?.legalName ?? r.contractorId;
        return (
          <Link
            href={complianceItemHref(r.contractorId, r.id)}
            className="text-sm text-primary hover:underline">
            {name}
          </Link>
        );
      },
    },
    {
      id: 'document',
      accessorFn: row => row.policyRuleId ?? row.name,
      header: t('columns.document'),
      cell: ({ row }) => <DocNameCell policyRuleId={row.original.policyRuleId} />,
    },
    {
      accessorKey: 'expiresAt',
      header: t('columns.expiresAt'),
      cell: ({ row }) => <ExpiresAtCell expiresAt={row.original.expiresAt} />,
    },
    {
      id: 'daysUntil',
      accessorFn: row => daysUntil(row.expiresAt) ?? Number.POSITIVE_INFINITY,
      header: t('columns.daysUntilExpiry'),
      cell: ({ row }) => {
        const d = daysUntil(row.original.expiresAt);
        return (
          <span className="text-sm tabular-nums text-muted-foreground">
            {d === null ? '—' : t('daysValue', { count: d })}
          </span>
        );
      },
    },
  ];
}
