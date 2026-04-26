'use client';

import { complianceState } from '@contractor-ops/einvoice/compliance';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, FileCheck, XCircle } from 'lucide-react';
import { useId } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// State → visual mapping
// ---------------------------------------------------------------------------

const stateBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  sandbox: 'secondary',
  degraded: 'secondary',
  onboarding: 'secondary',
  suspended: 'outline',
  error: 'destructive',
  [complianceState.notConnected]: 'outline',
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
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(date: Date | string | undefined): string {
  if (!date) return 'Never';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted">
        <div className={`h-1.5 rounded-full transition-all ${color}`} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{score}%</span>
    </div>
  );
}

function CapabilityItem({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs ${
        enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/40'
      }`}>
      {enabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Detailed compliance view for settings/integrations page.
 * Per D-08: full compliance info per profile with health score,
 * sync history, error log, and capability matrix.
 */
export function EInvoiceComplianceDetail() {
  const reactId = useId();
  const { data, isLoading } = useQuery(trpc.einvoice.complianceStatuses.queryOptions());

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const statuses = data?.statuses ?? [];

  return (
    <div className="space-y-6" id={`${reactId}-einvoice`}>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileCheck className="h-5 w-5 text-muted-foreground" />
          E-Invoicing Compliance
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Status of connected e-invoicing profiles for your organization.
        </p>
      </div>

      {statuses.length === 0 ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">No e-invoicing profiles configured.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {statuses.map(status => {
            const badgeVariant = stateBadgeVariant[status.state] ?? 'outline';
            const label = stateLabels[status.state] ?? status.state;

            return (
              <Card key={status.profileId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-base">
                      {status.displayName}
                      <Badge variant={badgeVariant}>{label}</Badge>
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">{status.country}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Health score */}
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Health</p>
                    <HealthBar score={status.healthScore} />
                  </div>

                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="font-medium text-muted-foreground">Last Sync:</span>{' '}
                      {formatTimeAgo(status.lastSyncAt as Date | undefined)}
                    </div>
                    {!!status.lastErrorMessage && (
                      <div className="col-span-2 truncate text-destructive">
                        <span className="font-medium">Error:</span> {status.lastErrorMessage}
                      </div>
                    )}
                  </div>

                  {/* Capabilities */}
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Capabilities</p>
                    <div className="flex flex-wrap gap-3">
                      <CapabilityItem label="Generate" enabled={status.capabilities.canGenerate} />
                      <CapabilityItem label="Parse" enabled={status.capabilities.canParse} />
                      <CapabilityItem label="Sign" enabled={status.capabilities.canSign} />
                      <CapabilityItem label="QR Code" enabled={status.capabilities.canQRCode} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
