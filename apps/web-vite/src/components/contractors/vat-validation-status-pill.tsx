// VAT validation status pill.

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle2, Minus, WifiOff, XCircle } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

type VatValidationStatus = 'valid' | 'invalid' | 'stale' | 'unavailable' | null;

interface VatValidationStatusPillProps {
  status: VatValidationStatus;
  validatedAt: Date | string | null;
}

interface VariantMeta {
  label: string;
  badgeVariant: 'success' | 'destructive' | 'warning' | 'secondary';
  icon: ReactNode;
  tooltip?: (relative: string) => string;
}

const VARIANT_MAP: Record<Exclude<VatValidationStatus, null> | 'not-validated', VariantMeta> = {
  valid: {
    label: 'Valid',
    badgeVariant: 'success',
    icon: <CheckCircle2 className="size-3" aria-hidden />,
  },
  invalid: {
    label: 'Invalid',
    badgeVariant: 'destructive',
    icon: <XCircle className="size-3" aria-hidden />,
  },
  stale: {
    label: 'Stale',
    badgeVariant: 'warning',
    icon: <AlertTriangle className="size-3" aria-hidden />,
    tooltip: (relative: string) => `Last validated ${relative} ago; live check unavailable`,
  },
  unavailable: {
    label: 'Unavailable',
    badgeVariant: 'warning',
    icon: <WifiOff className="size-3" aria-hidden />,
    tooltip: () => 'Live VAT check is temporarily unavailable',
  },
  'not-validated': {
    label: 'Not validated',
    badgeVariant: 'secondary',
    icon: <Minus className="size-3" aria-hidden />,
  },
};

export function VatValidationStatusPill({ status, validatedAt }: VatValidationStatusPillProps) {
  const key = status ?? 'not-validated';
  const variant = VARIANT_MAP[key];

  const relative = validatedAt ? formatDistanceToNow(new Date(validatedAt)) : null;
  const tooltipText =
    variant.tooltip && relative ? variant.tooltip(relative) : variant.tooltip?.('');

  const pill = (
    <Badge
      variant={variant.badgeVariant}
      data-testid="vat-validation-status-pill"
      data-status={key}
      aria-label={`VAT validation: ${variant.label}`}>
      {variant.icon}
      <span>{variant.label}</span>
    </Badge>
  );

  if (!tooltipText) return pill;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={pill as ReactElement} />
        <TooltipContent aria-label={tooltipText}>{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
