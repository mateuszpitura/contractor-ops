/**
 * Shared cell components and helpers for the compliance admin dashboard
 * column factories. Extracted to avoid duplication between at-risk-table and
 * upcoming-renewals-table (CF-L2).
 */

import { Link } from '../../../i18n/navigation.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { useComplDocName } from '../hooks/use-compl-doc-name.js';

/** Drilldown to the per-contractor Compliance tab, anchored to the item. */
export function complianceItemHref(contractorId: string, itemId: string): string {
  return `/contractors/${contractorId}/compliance#item-${itemId}`;
}

export function DocNameCell({ policyRuleId }: { policyRuleId: string | null }) {
  const { label, isPending } = useComplDocName(policyRuleId);
  return (
    <span className="text-sm">
      {label}
      {isPending && (
        <sup className="ms-0.5 text-muted-foreground" aria-hidden>
          †
        </sup>
      )}
    </span>
  );
}

export function ExpiresAtCell({ expiresAt }: { expiresAt: Date | string | null }) {
  const { formatDate } = useDateFormatter();
  if (!expiresAt) return <span className="text-muted-foreground">&mdash;</span>;
  return <span className="text-sm tabular-nums">{formatDate(new Date(expiresAt))}</span>;
}

/** Contractor link cell — renders display/legal name linked to the item anchor. */
export function ContractorLinkCell({
  contractorId,
  itemId,
  displayName,
  legalName,
}: {
  contractorId: string;
  itemId: string;
  displayName?: string | null;
  legalName?: string | null;
}) {
  const name = displayName ?? legalName ?? contractorId;
  return (
    <Link
      href={complianceItemHref(contractorId, itemId)}
      className="text-sm text-primary hover:underline">
      {name}
    </Link>
  );
}
