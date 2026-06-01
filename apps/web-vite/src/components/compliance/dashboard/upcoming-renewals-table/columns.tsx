import type { ColumnDef } from '@tanstack/react-table';

import type { LooseTranslator } from '../../../../i18n/typed-keys.js';
import type { UpcomingRow } from '../hooks/use-compliance-dashboard.js';
import { ContractorLinkCell, DocNameCell, ExpiresAtCell } from '../shared-columns.js';

// daysUntil uses browser-local TZ — approximate display value, not authoritative
// renewal boundary (CF-L3). The server-authoritative band is daysUntilExpiryInTz
// in packages/compliance-policy/src/expiry.ts.
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
        return (
          <ContractorLinkCell
            contractorId={r.contractorId}
            itemId={r.id}
            displayName={r.contractor?.displayName}
            legalName={r.contractor?.legalName}
          />
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
