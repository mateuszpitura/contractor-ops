import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { buttonVariants } from '@contractor-ops/ui/components/shadcn/button';

import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useComplDocName } from '../../compliance/hooks/use-compl-doc-name.js';
import type { PortalComplianceItem } from './hooks/use-portal-compliance.js';

const STATUS_BADGE_STYLES: Record<string, string> = {
  SATISFIED: 'bg-green-600/10 text-green-800 dark:text-green-400',
  MISSING: 'bg-red-500/10 text-red-500',
  EXPIRED: 'bg-red-500/10 text-red-500',
  WAIVED: 'bg-muted text-muted-foreground',
};

function PortalComplianceCard({ item }: { item: PortalComplianceItem }) {
  const t = useTranslations('Portal.compliance');
  const { label } = useComplDocName(item.policyRuleId);
  const needsAction = item.status === 'MISSING' || item.status === 'EXPIRED';
  const renewHref = `/portal/compliance/upload-replacement?itemId=${encodeURIComponent(item.id)}&policyRuleId=${encodeURIComponent(item.policyRuleId ?? '')}`;

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium">{label || item.name}</span>
        <Badge variant="secondary" className={STATUS_BADGE_STYLES[item.status] ?? ''}>
          {item.status}
        </Badge>
      </div>
      {needsAction && (
        <Link href={renewHref} className={buttonVariants({ size: 'sm', className: 'self-start' })}>
          {t('renewNow')}
        </Link>
      )}
    </li>
  );
}

export interface PortalComplianceListProps {
  items: PortalComplianceItem[];
}

/** Presentational — renders the contractor's compliance items as cards. */
export function PortalComplianceList({ items }: PortalComplianceListProps) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map(item => (
        <PortalComplianceCard key={item.id} item={item} />
      ))}
    </ul>
  );
}
