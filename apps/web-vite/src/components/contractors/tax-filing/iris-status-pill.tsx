import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { AlertTriangle, CheckCircle2, Clock, HelpCircle, Loader2, XCircle } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { IrisStatus } from './hooks/use-iris-filing.js';

interface StatusMeta {
  labelKey: string;
  tooltipKey: string;
  badgeVariant: 'success' | 'warning' | 'secondary' | 'destructive' | 'info';
  icon: ReactNode;
}

// IRIS status colours: Accepted/VALID = success (green); Rejected/INVALID = the
// only red; Partial / Accepted-with-Errors = warning (amber); Processing = info
// (blue); Not Found = warning; a pending schema bundle is a muted secondary
// (validity unproven, not a failure).
const STATUS_MAP: Record<IrisStatus, StatusMeta> = {
  VALID: {
    labelKey: 'status.valid',
    tooltipKey: 'statusTooltip.valid',
    badgeVariant: 'success',
    icon: <CheckCircle2 className="size-3" aria-hidden />,
  },
  ACCEPTED: {
    labelKey: 'status.accepted',
    tooltipKey: 'statusTooltip.accepted',
    badgeVariant: 'success',
    icon: <CheckCircle2 className="size-3" aria-hidden />,
  },
  INVALID: {
    labelKey: 'status.invalid',
    tooltipKey: 'statusTooltip.invalid',
    badgeVariant: 'destructive',
    icon: <XCircle className="size-3" aria-hidden />,
  },
  REJECTED: {
    labelKey: 'status.rejected',
    tooltipKey: 'statusTooltip.rejected',
    badgeVariant: 'destructive',
    icon: <XCircle className="size-3" aria-hidden />,
  },
  PARTIALLY_ACCEPTED: {
    labelKey: 'status.partiallyAccepted',
    tooltipKey: 'statusTooltip.partiallyAccepted',
    badgeVariant: 'warning',
    icon: <AlertTriangle className="size-3" aria-hidden />,
  },
  ACCEPTED_WITH_ERRORS: {
    labelKey: 'status.acceptedWithErrors',
    tooltipKey: 'statusTooltip.acceptedWithErrors',
    badgeVariant: 'warning',
    icon: <AlertTriangle className="size-3" aria-hidden />,
  },
  PROCESSING: {
    labelKey: 'status.processing',
    tooltipKey: 'statusTooltip.processing',
    badgeVariant: 'info',
    icon: <Loader2 className="size-3" aria-hidden />,
  },
  NOT_FOUND: {
    labelKey: 'status.notFound',
    tooltipKey: 'statusTooltip.notFound',
    badgeVariant: 'warning',
    icon: <HelpCircle className="size-3" aria-hidden />,
  },
  BUNDLE_UNAVAILABLE: {
    labelKey: 'status.bundleUnavailable',
    tooltipKey: 'statusTooltip.bundleUnavailable',
    badgeVariant: 'secondary',
    icon: <Clock className="size-3" aria-hidden />,
  },
};

export function IrisStatusPill({ status }: { status: IrisStatus }) {
  const t = useTranslations('Tax1099Filing');
  const meta = STATUS_MAP[status];
  const label = t(meta.labelKey);

  const pill = (
    <Badge
      variant={meta.badgeVariant}
      data-testid="iris-status-pill"
      data-status={status}
      aria-label={t('pillAriaLabel', { status: label })}>
      {meta.icon}
      <span>{label}</span>
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={pill as ReactElement} />
        <TooltipContent>{t(meta.tooltipKey)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
