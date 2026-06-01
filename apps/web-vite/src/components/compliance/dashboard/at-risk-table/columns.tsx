import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import type { ColumnDef } from '@tanstack/react-table';

import { Link } from '../../../../i18n/navigation.js';
import type { LooseTranslator } from '../../../../i18n/typed-keys.js';
import { tDynLoose } from '../../../../i18n/typed-keys.js';
import { enumKey } from '../../../../lib/enum-key.js';
import { useDateFormatter } from '../../../../lib/format/use-date-formatter.js';
import { useComplDocName } from '../../hooks/use-compl-doc-name.js';
import type { AtRiskRow } from '../hooks/use-compliance-dashboard.js';

/** Drilldown to the per-contractor Compliance tab, anchored to the item (D-05). */
function complianceItemHref(contractorId: string, itemId: string): string {
  return `/contractors/${contractorId}/compliance#item-${itemId}`;
}

// Mirrors the status badge palette in tab-compliance.tsx (single source of truth).
const STATUS_BADGE_STYLES: Record<string, string> = {
  SATISFIED: 'bg-green-600/10 text-green-800 dark:text-green-400',
  MISSING: 'bg-red-500/10 text-red-500',
  EXPIRED: 'bg-red-500/10 text-red-500',
  WAIVED: 'bg-muted text-muted-foreground',
};

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

export function getAtRiskColumns(t: LooseTranslator): ColumnDef<AtRiskRow>[] {
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
      accessorKey: 'status',
      header: t('columns.status'),
      cell: ({ row }) => (
        <Badge variant="secondary" className={STATUS_BADGE_STYLES[row.original.status] ?? ''}>
          {tDynLoose(t, 'status', enumKey(row.original.status))}
        </Badge>
      ),
    },
    {
      accessorKey: 'expiresAt',
      header: t('columns.expiresAt'),
      cell: ({ row }) => <ExpiresAtCell expiresAt={row.original.expiresAt} />,
    },
  ];
}
