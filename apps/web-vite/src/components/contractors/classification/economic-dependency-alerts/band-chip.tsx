// Phase 60 · CLASS-07 — EconomicDependencyBandChip.
// Step 11 codemod port from apps/web/src/components/contractors/classification/economic-dependency-alerts/band-chip.tsx.

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import type { LucideIcon } from 'lucide-react';
import { CircleCheck, ShieldAlert, ShieldX } from 'lucide-react';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { cn } from '../../../../lib/utils.js';

export type EconomicDependencyBand = 'safe' | 'warning' | 'critical';

export interface EconomicDependencyBandChipProps {
  band: EconomicDependencyBand;
  billingShare: number;
  className?: string;
}

interface BandPresentation {
  label: 'bandSafe' | 'bandWarning' | 'bandCritical';
  icon: LucideIcon;
  containerClass: string;
  iconClass: string;
  variant: 'success' | 'warning' | 'destructive';
}

const PRESENTATION: Record<EconomicDependencyBand, BandPresentation> = {
  safe: {
    label: 'bandSafe',
    icon: CircleCheck,
    containerClass: 'bg-[--success]/10 text-[--success]',
    iconClass: 'text-[--success]',
    variant: 'success',
  },
  warning: {
    label: 'bandWarning',
    icon: ShieldAlert,
    containerClass: 'bg-[--warning]/10 text-[--warning]',
    iconClass: 'text-[--warning]',
    variant: 'warning',
  },
  critical: {
    label: 'bandCritical',
    icon: ShieldX,
    containerClass: 'bg-[--destructive]/10 text-[--destructive]',
    iconClass: 'text-[--destructive]',
    variant: 'destructive',
  },
};

export function EconomicDependencyBandChip({
  band,
  billingShare,
  className,
}: EconomicDependencyBandChipProps) {
  const t = useTranslations('Classification.polish.economicDependency');
  const presentation = PRESENTATION[band];
  const Icon = presentation.icon;
  const label = t(presentation.label);
  const percent = Math.round(billingShare * 100);
  const ariaLabel = `${label} — ${percent}%`;

  return (
    <Badge
      variant={presentation.variant}
      className={cn('gap-1.5 py-1 px-2', presentation.containerClass, className)}
      aria-label={ariaLabel}
      data-band={band}>
      <Icon aria-hidden="true" className={cn('size-3.5', presentation.iconClass)} />
      <span>{label}</span>
    </Badge>
  );
}
