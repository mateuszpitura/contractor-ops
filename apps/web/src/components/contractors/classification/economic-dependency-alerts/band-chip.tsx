'use client';

// ---------------------------------------------------------------------------
// Phase 60 · CLASS-07 — EconomicDependencyBandChip
// ---------------------------------------------------------------------------
// Semantic triad (colour + icon + text) per 60-UI-SPEC "CLASS-07 — Economic-
// Dependency Alerts". Never communicates band by colour alone (WCAG 1.4.1).
//
// Uses the OKLCh tokens from apps/web/src/app/globals.css:
//   - --success     → safe band
//   - --warning     → warning band (70% §2 SGB VI)
//   - --destructive → critical band (83.33% §2 SGB VI)

import type { LucideIcon } from 'lucide-react';
import { CircleCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type EconomicDependencyBand = 'safe' | 'warning' | 'critical';

export interface EconomicDependencyBandChipProps {
  band: EconomicDependencyBand;
  /** 0..1 — rendered as `{percent}%` in the aria-label. */
  billingShare: number;
  className?: string;
}

interface BandPresentation {
  label: 'bandSafe' | 'bandWarning' | 'bandCritical';
  icon: LucideIcon;
  // Semantic triad tokens — NEVER inline hex colours per UI-SPEC.
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
      data-band={band}
    >
      <Icon aria-hidden="true" className={cn('size-3.5', presentation.iconClass)} />
      <span>{label}</span>
    </Badge>
  );
}
