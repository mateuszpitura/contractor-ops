'use client';

import { complianceState } from '@contractor-ops/einvoice';
import { Globe } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PeppolComplianceWidgetProps {
  status: {
    state: string;
    healthScore: number;
  };
  transmissionCounts?: {
    sent: number;
    received: number;
  };
}

// ---------------------------------------------------------------------------
// State dot
// ---------------------------------------------------------------------------

const STATE_COLORS: Record<string, string> = {
  active: 'bg-success',
  onboarding: 'bg-warning',
  suspended: 'bg-destructive',
  error: 'bg-destructive',
  [complianceState.notConnected]: 'bg-muted-foreground/30',
};

const STATE_LABELS: Record<string, string> = {
  active: 'Active',
  onboarding: 'Onboarding',
  suspended: 'Suspended',
  error: 'Error',
  [complianceState.notConnected]: 'Not Connected',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Row component for the compliance widget on the dashboard.
 * Shows Peppol (UAE) status alongside other e-invoicing profiles.
 */
export function PeppolComplianceWidget({
  status,
  transmissionCounts,
}: PeppolComplianceWidgetProps) {
  const dotColor = STATE_COLORS[status.state] ?? STATE_COLORS[complianceState.notConnected];
  const label = STATE_LABELS[status.state] ?? 'Unknown';

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">Peppol (UAE)</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${dotColor}`} />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        {transmissionCounts && (
          <span className="font-mono text-sm text-muted-foreground">
            {transmissionCounts.sent} sent, {transmissionCounts.received} rcvd
          </span>
        )}
      </div>
    </div>
  );
}
