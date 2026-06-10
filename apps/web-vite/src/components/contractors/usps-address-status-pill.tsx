// USPS address validation status pill. Mirrors VatValidationStatusPill.
//
// Advisory only: the pill communicates whether the address was CASS-verified
// against USPS, but never blocks save — an unverified or unavailable result
// is a fully saveable state.

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle2, Loader2, Minus, WifiOff } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';

export type UspsAddressStatus =
  | 'verified'
  | 'unverified'
  | 'validating'
  | 'unavailable'
  | 'not-validated'
  | null;

interface UspsAddressStatusPillProps {
  status: UspsAddressStatus;
  validatedAt?: Date | string | null;
}

type StatusKey = Exclude<UspsAddressStatus, null>;

interface VariantMeta {
  labelKey: string;
  badgeVariant: 'success' | 'warning' | 'secondary';
  icon: ReactNode;
  tooltipKey?: string;
  withRelative?: boolean;
}

const VARIANT_MAP: Record<StatusKey, VariantMeta> = {
  verified: {
    labelKey: 'uspsVerified',
    badgeVariant: 'success',
    icon: <CheckCircle2 className="size-3" aria-hidden />,
    tooltipKey: 'uspsVerifiedTooltip',
    withRelative: true,
  },
  unverified: {
    labelKey: 'uspsUnverified',
    badgeVariant: 'warning',
    icon: <AlertTriangle className="size-3" aria-hidden />,
    tooltipKey: 'uspsUnverifiedTooltip',
  },
  validating: {
    labelKey: 'uspsValidating',
    badgeVariant: 'secondary',
    icon: <Loader2 className="size-3 animate-spin" aria-hidden />,
  },
  unavailable: {
    labelKey: 'uspsUnavailable',
    badgeVariant: 'warning',
    icon: <WifiOff className="size-3" aria-hidden />,
    tooltipKey: 'uspsUnavailableTooltip',
  },
  'not-validated': {
    labelKey: 'uspsNotValidated',
    badgeVariant: 'secondary',
    icon: <Minus className="size-3" aria-hidden />,
  },
};

export function UspsAddressStatusPill({ status, validatedAt }: UspsAddressStatusPillProps) {
  const t = useTranslations('Contractors.compliance.us');
  const key: StatusKey = status ?? 'not-validated';
  const variant = VARIANT_MAP[key];

  const label = t(variant.labelKey);
  const relative = validatedAt ? formatDistanceToNow(new Date(validatedAt)) : null;
  const tooltipText = variant.tooltipKey
    ? variant.withRelative && relative
      ? t(variant.tooltipKey, { relative })
      : t(variant.tooltipKey)
    : undefined;

  const pill = (
    <Badge
      variant={variant.badgeVariant}
      data-testid="usps-address-status-pill"
      data-status={key}
      aria-label={t('uspsPillAriaLabel', { status: label })}>
      {variant.icon}
      <span>{label}</span>
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
