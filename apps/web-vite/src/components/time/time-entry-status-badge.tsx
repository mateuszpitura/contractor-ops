/**
 * Timesheet status badge.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';

const STATUS_CONFIG = {
  DRAFT: { variant: 'info' as const, label: 'Draft' },
  SUBMITTED: { variant: 'warning' as const, label: 'Submitted' },
  APPROVED: { variant: 'success' as const, label: 'Approved' },
  REJECTED: { variant: 'destructive' as const, label: 'Rejected' },
} as const;

interface TimeEntryStatusBadgeProps {
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
}

export function TimeEntryStatusBadge({ status }: TimeEntryStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
