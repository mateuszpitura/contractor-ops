import type { ColumnDef } from '@tanstack/react-table';

import type { LooseTranslator } from '../../../../i18n/typed-keys.js';
import { ComplianceStatusBadge } from '../../compliance-status-badge.js';
import type { AtRiskRow } from '../hooks/use-compliance-dashboard.js';
import { ContractorLinkCell, DocNameCell, ExpiresAtCell } from '../shared-columns.js';

export function getAtRiskColumns(t: LooseTranslator): ColumnDef<AtRiskRow>[] {
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
      accessorKey: 'status',
      header: t('columns.status'),
      cell: ({ row }) => <ComplianceStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'expiresAt',
      header: t('columns.expiresAt'),
      cell: ({ row }) => <ExpiresAtCell expiresAt={row.original.expiresAt} />,
    },
  ];
}
