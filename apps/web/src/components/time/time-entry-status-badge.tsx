'use client';

import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Status -> badge variant mapping per UI-SPEC
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  DRAFT: { variant: 'info' as const, label: 'Draft' },
  SUBMITTED: { variant: 'warning' as const, label: 'Submitted' },
  APPROVED: { variant: 'success' as const, label: 'Approved' },
  REJECTED: { variant: 'destructive' as const, label: 'Rejected' },
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimeEntryStatusBadgeProps {
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Reusable status badge for timesheet/time entry statuses.
 * Maps status enum to badge variant per UI-SPEC Status Badge Mapping.
 */
export function TimeEntryStatusBadge({ status }: TimeEntryStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
