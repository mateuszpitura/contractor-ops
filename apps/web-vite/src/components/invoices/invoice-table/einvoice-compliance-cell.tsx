import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Circle, CircleCheck, CircleDashed, ShieldAlert, ShieldX } from 'lucide-react';
import type { ComponentType, MouseEvent } from 'react';

import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { EInvoiceComplianceFilter } from './compliance-filter-param.js';

export type EInvoiceComplianceStatus = Exclude<EInvoiceComplianceFilter, 'all'>;

type StatusVisualConfig = {
  icon: ComponentType<{ className?: string }>;
  className: string;
  labelKey: EInvoiceComplianceStatus;
};

const STATUS_VISUALS: Record<EInvoiceComplianceStatus, StatusVisualConfig> = {
  notGenerated: {
    icon: Circle,
    className: 'border-muted text-muted-foreground bg-muted/40',
    labelKey: 'notGenerated',
  },
  valid: {
    icon: CircleCheck,
    className: 'border-green-600/40 text-green-800 dark:text-green-400 bg-green-600/10',
    labelKey: 'valid',
  },
  warnings: {
    icon: ShieldAlert,
    className: 'border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10',
    labelKey: 'warnings',
  },
  invalid: {
    icon: ShieldX,
    className: 'border-destructive/40 text-destructive bg-destructive/10',
    labelKey: 'invalid',
  },
  transmitted: {
    icon: CircleDashed,
    className: 'border-blue-500/40 text-blue-700 dark:text-blue-400 bg-blue-500/10',
    labelKey: 'transmitted',
  },
  failed: {
    icon: ShieldX,
    className: 'border-destructive/40 text-destructive bg-destructive/10',
    labelKey: 'failed',
  },
};

interface EInvoiceComplianceCellProps {
  status: EInvoiceComplianceStatus;
  invoiceId: string;
  className?: string;
}

const stopRowClick = (e: MouseEvent) => {
  e.stopPropagation();
};

export function EInvoiceComplianceCell({
  status,
  invoiceId,
  className,
}: EInvoiceComplianceCellProps) {
  const t = useTranslations('EInvoice.InvoicesList.Cell');

  const visual = STATUS_VISUALS[status];
  const Icon = visual.icon;

  return (
    <Link
      href={`/invoices/${invoiceId}?tab=e-invoice`}
      className={`inline-flex items-center ${className ?? ''}`}
      aria-label={t(visual.labelKey)}
      onClick={stopRowClick}>
      <Badge variant="outline" className={`gap-1 ${visual.className}`}>
        <Icon className="h-3 w-3" aria-hidden="true" />
        <span>{t(visual.labelKey)}</span>
      </Badge>
    </Link>
  );
}
