'use client';

import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ZatcaBadgeStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'CLEARED'
  | 'REPORTED'
  | 'REJECTED'
  | 'WARNING';

// ---------------------------------------------------------------------------
// Status → badge variant + label mapping (per UI-SPEC Section 2)
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ZatcaBadgeStatus,
  { variant: 'warning' | 'info' | 'success' | 'destructive'; label: string }
> = {
  PENDING: { variant: 'warning', label: 'ZATCA Pending' },
  SUBMITTED: { variant: 'info', label: 'ZATCA Submitted' },
  CLEARED: { variant: 'success', label: 'ZATCA Cleared' },
  REPORTED: { variant: 'success', label: 'ZATCA Reported' },
  REJECTED: { variant: 'destructive', label: 'ZATCA Rejected' },
  WARNING: { variant: 'warning', label: 'ZATCA Warning' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ZatcaStatusBadgeProps {
  status: ZatcaBadgeStatus;
  /** Optional date for screen reader context */
  date?: string;
  className?: string;
}

/**
 * ZATCA submission status badge for invoice detail view.
 * 6 variants per UI-SPEC:
 * - PENDING: warning
 * - SUBMITTED: info
 * - CLEARED: success
 * - REPORTED: success
 * - REJECTED: destructive
 * - WARNING: warning
 *
 * Includes aria-label with full status context.
 */
export function ZatcaStatusBadge({ status, date, className }: ZatcaStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  const ariaLabel = date
    ? `ZATCA status: ${config.label.replace('ZATCA ', '')} on ${date}`
    : `ZATCA status: ${config.label.replace('ZATCA ', '')}`;

  return (
    <Badge variant={config.variant} className={className} aria-label={ariaLabel}>
      {config.label}
    </Badge>
  );
}
