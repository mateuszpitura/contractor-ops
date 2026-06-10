import type { ColumnDef } from '@tanstack/react-table';

import { Link } from '../../../../i18n/navigation.js';
import type { LooseTranslator } from '../../../../i18n/typed-keys.js';
import type { BlockedRow } from '../hooks/use-compliance-dashboard.js';

/**
 * Renders the contractorReasons[] grouping — one row per contractor, with
 * the blocked documents listed and each linking to the per-contractor Compliance
 * tab via the `deepLinkPath` issued by the payment gate.
 */
export function getBlockedPaymentsColumns(t: LooseTranslator): ColumnDef<BlockedRow>[] {
  return [
    {
      id: 'contractor',
      accessorFn: row => row.contractorName || row.contractorId,
      header: t('columns.contractor'),
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.contractorName || row.original.contractorId}
        </span>
      ),
    },
    {
      id: 'documents',
      header: t('columns.blockedDocuments'),
      enableSorting: false,
      cell: ({ row }) => {
        const reasons = row.original.reasons ?? [];
        if (reasons.length === 0) {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
        return (
          <ul className="flex flex-col gap-1">
            {reasons.map(reason => (
              <li key={reason.itemId} className="text-sm">
                <Link href={reason.deepLinkPath} className="text-primary hover:underline">
                  {t(reason.documentTypeLabelKey)}
                </Link>
                <span className="ms-2 text-xs text-muted-foreground tabular-nums">
                  {reason.expiredOnDate}
                </span>
              </li>
            ))}
          </ul>
        );
      },
    },
    {
      id: 'source',
      accessorKey: 'source',
      header: t('columns.source'),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {t(
            row.original.source === 'live'
              ? 'blockedPayments.sourceLive'
              : 'blockedPayments.sourceHistorical',
          )}
          {row.original.paymentRunId ? ` · ${row.original.paymentRunId}` : ''}
        </span>
      ),
    },
  ];
}
