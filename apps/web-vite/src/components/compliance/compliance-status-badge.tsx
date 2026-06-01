import { Badge } from '@contractor-ops/ui/components/shadcn/badge';

import { tDynLoose } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';

type ComplianceStatus = 'SATISFIED' | 'MISSING' | 'EXPIRED' | 'PENDING' | 'WAIVED';

const STATUS_CLASS_MAP: Record<ComplianceStatus, string> = {
  SATISFIED: 'bg-green-600/10 text-green-800 dark:text-green-400',
  MISSING: 'bg-red-500/10 text-red-500',
  EXPIRED: 'bg-red-500/10 text-red-500',
  PENDING: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  WAIVED: 'bg-muted text-muted-foreground',
};

interface ComplianceStatusBadgeProps {
  status: string;
  className?: string;
}

/** Single source of truth for the compliance item status badge palette. */
export function ComplianceStatusBadge({ status, className }: ComplianceStatusBadgeProps) {
  const t = useTranslations('Compliance.dashboard');
  const cls = STATUS_CLASS_MAP[status as ComplianceStatus] ?? '';
  const label = tDynLoose(t, 'status', enumKey(status));
  return (
    <Badge variant="secondary" className={`${cls} ${className ?? ''}`.trim()} aria-label={label}>
      {label}
    </Badge>
  );
}
