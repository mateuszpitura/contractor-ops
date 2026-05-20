'use client';

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SlaBadgeProps {
  /** ISO date string for the SLA deadline */
  slaDeadline: string | null;
  /** Current step status */
  status: string;
  /** Total SLA hours from chain config (for percentage calculation) */
  slaHours?: number;
}

// ---------------------------------------------------------------------------
// SLA color thresholds per UI-SPEC D-08
// ---------------------------------------------------------------------------

type SlaLevel = 'green' | 'yellow' | 'red' | 'overdue';

function getSlaLevel(remainingMs: number, slaHours?: number): SlaLevel {
  if (remainingMs <= 0) return 'overdue';

  if (slaHours && slaHours > 0) {
    const totalMs = slaHours * 3600000;
    const percentage = (remainingMs / totalMs) * 100;
    if (percentage > 50) return 'green';
    if (percentage > 25) return 'yellow';
    return 'red';
  }

  // Fallback: estimate based on absolute hours remaining
  const hoursLeft = remainingMs / 3600000;
  if (hoursLeft > 24) return 'green';
  if (hoursLeft > 8) return 'yellow';
  return 'red';
}

const SLA_STYLES: Record<SlaLevel, string> = {
  green: 'bg-green-500/10 text-green-600 dark:text-green-400',
  yellow: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  red: 'bg-destructive/10 text-destructive',
  overdue: 'bg-destructive/[0.15] text-destructive border border-destructive/30',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SLA countdown badge with color-coded status.
 * Updates every minute via setInterval. Returns null for non-PENDING steps
 * or when no deadline is set.
 */
export function SlaBadge({ slaDeadline, status, slaHours }: SlaBadgeProps) {
  const [now, setNow] = useState(() => Date.now());

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Only show for PENDING steps with a deadline
  if (!slaDeadline || status !== 'PENDING') return null;

  const deadlineMs = new Date(slaDeadline).getTime();
  const remainingMs = deadlineMs - now;
  const level = getSlaLevel(remainingMs, slaHours);

  let label: string;
  if (remainingMs <= 0) {
    const overdueHours = Math.ceil(Math.abs(remainingMs) / 3600000);
    label = `OVERDUE ${overdueHours}h`;
  } else {
    const hoursLeft = Math.ceil(remainingMs / 3600000);
    label = `${hoursLeft}h left`;
  }

  return (
    <Badge
      variant="secondary"
      className={`min-w-[72px] justify-center text-[12px] font-medium tabular-nums ${SLA_STYLES[level]}`}>
      {label}
    </Badge>
  );
}
