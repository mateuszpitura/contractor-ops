'use client';

import { complianceState } from '@contractor-ops/einvoice';
import { useQuery } from '@tanstack/react-query';
import { FileCheck } from 'lucide-react';
import { PeppolComplianceWidget } from '@/components/peppol/peppol-compliance-widget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// State → color mapping (per D-08: green/yellow/red/gray)
// ---------------------------------------------------------------------------

const stateStyles: Record<string, { bg: string; text: string; dot: string }> = {
  active: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  sandbox: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  degraded: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  onboarding: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  suspended: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground/40',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
  },
  [complianceState.notConnected]: {
    bg: 'bg-muted/50',
    text: 'text-muted-foreground/60',
    dot: 'bg-muted-foreground/30',
  },
};

const stateLabels: Record<string, string> = {
  active: 'Active',
  sandbox: 'Sandbox',
  degraded: 'Degraded',
  onboarding: 'Onboarding',
  suspended: 'Suspended',
  error: 'Error',
  [complianceState.notConnected]: 'Not Connected',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Compact dashboard widget showing e-invoicing compliance at a glance.
 * Per D-08: green (active), yellow (degraded/sandbox), red (error/suspended),
 * gray (not connected).
 */
export function EInvoiceComplianceWidget() {
  const { data, isLoading } = useQuery(trpc.einvoice.complianceStatuses.queryOptions());
  const { data: peppolStatus } = useQuery(trpc.peppol.getStatus.queryOptions());

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const statuses = data?.statuses ?? [];

  // Derive Peppol compliance state from connection status
  const PEPPOL_STATUS_MAP: Record<string, string> = {
    ACTIVE: 'active',
    PENDING: 'onboarding',
    REGISTERED: 'onboarding',
    SUSPENDED: 'suspended',
  };
  const peppolState = peppolStatus
    ? (PEPPOL_STATUS_MAP[peppolStatus.participant.status] ?? 'error')
    : null;

  if (statuses.length === 0 && !peppolState) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <FileCheck className="h-4 w-4 text-muted-foreground" />
          E-Invoicing Compliance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {statuses.map(status => {
          const style = stateStyles[status.state] ?? stateStyles[complianceState.notConnected];
          const label = stateLabels[status.state] ?? status.state;
          return (
            <Link
              key={status.profileId}
              href="/settings#einvoice"
              className={`flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:opacity-80 ${style.bg}`}>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${style.dot}`}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">{status.displayName}</span>
              </div>
              <span className={`text-xs font-medium ${style.text}`}>{label}</span>
            </Link>
          );
        })}
        {!!peppolState && (
          <PeppolComplianceWidget
            status={{
              state: peppolState,
              healthScore: peppolState === 'active' ? 100 : peppolState === 'onboarding' ? 50 : 0,
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
