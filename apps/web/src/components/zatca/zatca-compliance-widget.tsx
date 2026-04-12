'use client';

import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import type { ComplianceStats } from './zatca-trpc';
import { zatcaTrpc } from './zatca-trpc';

// ---------------------------------------------------------------------------
// Status dot color mapping
// ---------------------------------------------------------------------------

const STATUS_DOTS: Record<string, string> = {
  production: 'bg-green-500',
  sandbox: 'bg-amber-500',
  error: 'bg-red-500',
  disconnected: 'bg-muted-foreground/30',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ZatcaComplianceWidgetProps {
  connectionStatus?: string;
  environment?: string;
  certificateExpiresAt?: string;
}

/**
 * ZATCA Compliance Widget for Settings > Integrations page.
 * Per UI-SPEC Section 4:
 * - Status dot colored per connection state
 * - Certificate expiry with yellow (<30d) / red (<7d) warnings
 * - Period stats: cleared, reported, pending, rejected counts
 * - Health bar: percentage of successful submissions
 */
export function ZatcaComplianceWidget({
  connectionStatus = 'production',
  environment = 'Production',
  certificateExpiresAt,
}: ZatcaComplianceWidgetProps) {
  const statsQuery = useQuery(zatcaTrpc.getComplianceStats.queryOptions());
  const stats = statsQuery.data as ComplianceStats | undefined;

  // Certificate expiry calculation
  let expiryDays: number | null = null;
  let expiryColor = 'text-muted-foreground';
  if (certificateExpiresAt) {
    const diff = new Date(certificateExpiresAt).getTime() - Date.now();
    expiryDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    if (expiryDays < 7) {
      expiryColor = 'text-red-600 dark:text-red-400';
    } else if (expiryDays < 30) {
      expiryColor = 'text-amber-600 dark:text-amber-400';
    }
  }

  // Health calculation
  const total = stats?.total ?? 0;
  const successful = (stats?.cleared ?? 0) + (stats?.reported ?? 0);
  const healthPercent = total > 0 ? Math.round((successful / total) * 100) : 100;

  if (statsQuery.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-5 w-5" />
          ZATCA (Saudi Arabia)
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status + Environment row */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span>Status:</span>
            <span className="flex items-center gap-1.5 font-medium capitalize">
              {connectionStatus}
              <span
                className={`inline-block h-2 w-2 rounded-full ${STATUS_DOTS[connectionStatus] ?? STATUS_DOTS.disconnected}`}
                aria-hidden="true"
              />
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Environment:</span>
            <span className="font-medium">{environment}</span>
          </div>
        </div>

        {/* Certificate expiry */}
        {expiryDays !== null && (
          <div className="text-sm">
            <span className="text-muted-foreground">Certificate expires: </span>
            <span className={expiryColor}>
              {certificateExpiresAt?.slice(0, 10)} ({expiryDays} days)
            </span>
            {expiryDays < 30 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Your ZATCA certificate expires in {expiryDays} days. Renew to avoid submission
                disruption.
              </p>
            )}
          </div>
        )}

        {/* Period stats */}
        {stats && (
          <div className="space-y-1.5 text-sm">
            <p className="font-medium text-muted-foreground">This Period</p>
            <div className="space-y-1 ps-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Cleared:</span>
                <span className="font-mono text-sm">{stats.cleared} invoices</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Reported:</span>
                <span className="font-mono text-sm">{stats.reported} invoices</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Pending:</span>
                <span className="font-mono text-sm">{stats.pending} invoices</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Rejected:</span>
                <span className="font-mono text-sm">{stats.rejected} invoices</span>
              </div>
            </div>
          </div>
        )}

        {/* Health bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Health:</span>
            <span className="font-mono text-xs">{healthPercent}%</span>
          </div>
          <Progress value={healthPercent} />
        </div>
      </CardContent>
    </Card>
  );
}
