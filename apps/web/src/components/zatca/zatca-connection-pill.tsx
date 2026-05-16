'use client';

import type { ZatcaOnboardingState } from '@contractor-ops/einvoice/zatca/types';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2, Unplug } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { zatcaTrpc } from './zatca-trpc';

// ---------------------------------------------------------------------------
// ZATCA Connection Status Pill
// ---------------------------------------------------------------------------

/**
 * Overall ZATCA connection status pill, derived from `getOnboardingState`.
 *
 * Maps onboarding state -> dashboard status enum:
 * - `CONNECTED`  — production certificate active
 * - `IN_PROGRESS`— wizard started, not yet finalized
 * - `DISCONNECTED` — fresh org, no setup
 * - `ERROR`     — query failed
 *
 * Polls every 30s (provider-connection-card pattern) so multi-step state
 * changes (e.g. cert expiry) surface without a page reload.
 */

type DerivedStatus = 'CONNECTED' | 'IN_PROGRESS' | 'DISCONNECTED' | 'ERROR';

const STATUS_BADGE_CLASSES: Record<DerivedStatus, string> = {
  CONNECTED: 'bg-emerald-500/10 text-emerald-500',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  DISCONNECTED: 'bg-muted text-muted-foreground',
  ERROR: 'bg-destructive/10 text-destructive',
};

const STATUS_ICONS: Record<DerivedStatus, typeof CheckCircle2> = {
  CONNECTED: CheckCircle2,
  IN_PROGRESS: Loader2,
  DISCONNECTED: Unplug,
  ERROR: AlertCircle,
};

export function ZatcaConnectionPill() {
  const t = useTranslations('Zatca.connectionPill');

  const stateQuery = useQuery(
    zatcaTrpc.getOnboardingState.queryOptions(undefined, { refetchInterval: 30_000 }),
  );

  if (stateQuery.isLoading) {
    return <Skeleton className="h-6 w-32" />;
  }

  const state = stateQuery.data as ZatcaOnboardingState | undefined;

  let status: DerivedStatus;
  if (stateQuery.isError) {
    status = 'ERROR';
  } else if (state?.productionCertActive === true) {
    status = 'CONNECTED';
  } else if (state && state.currentStep !== 'tax_details') {
    status = 'IN_PROGRESS';
  } else {
    status = 'DISCONNECTED';
  }

  const Icon = STATUS_ICONS[status];
  const isSpinner = status === 'IN_PROGRESS';

  return (
    <Badge
      variant="secondary"
      className={`gap-1.5 ${STATUS_BADGE_CLASSES[status]}`}
      aria-live="polite">
      <Icon className={`size-3.5 ${isSpinner ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span className="text-xs font-medium">
        {t(`status.${status}` as Parameters<typeof t>[0])}
      </span>
    </Badge>
  );
}
