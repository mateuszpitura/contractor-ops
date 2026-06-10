import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertCircle, CheckCircle2, Loader2, Unplug } from 'lucide-react';

import { tDyn } from '../../i18n/typed-keys';
import type { ZatcaDerivedStatus } from './hooks/use-zatca-connection-pill.js';
import { useZatcaConnectionPill } from './hooks/use-zatca-connection-pill.js';

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

const STATUS_BADGE_CLASSES: Record<ZatcaDerivedStatus, string> = {
  CONNECTED: 'bg-emerald-500/10 text-emerald-500',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  DISCONNECTED: 'bg-muted text-muted-foreground',
  ERROR: 'bg-destructive/10 text-destructive',
};

const STATUS_ICONS: Record<ZatcaDerivedStatus, typeof CheckCircle2> = {
  CONNECTED: CheckCircle2,
  IN_PROGRESS: Loader2,
  DISCONNECTED: Unplug,
  ERROR: AlertCircle,
};

export function ZatcaConnectionPillSkeleton() {
  return <Skeleton className="h-6 w-32" />;
}

export type ZatcaConnectionPillViewProps = Omit<
  ReturnType<typeof useZatcaConnectionPill>,
  'isLoading'
>;

export function ZatcaConnectionPill() {
  const { isLoading, ...props } = useZatcaConnectionPill();
  if (isLoading) return <ZatcaConnectionPillSkeleton />;
  return <ZatcaConnectionPillView {...props} />;
}

export function ZatcaConnectionPillView({ status, t }: ZatcaConnectionPillViewProps) {
  const Icon = STATUS_ICONS[status];
  const isSpinner = status === 'IN_PROGRESS';

  return (
    <Badge
      variant="secondary"
      className={`gap-1.5 ${STATUS_BADGE_CLASSES[status]}`}
      aria-live="polite">
      <Icon className={`size-3.5 ${isSpinner ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span className="text-xs font-medium">{tDyn(t, 'status', status)}</span>
    </Badge>
  );
}
