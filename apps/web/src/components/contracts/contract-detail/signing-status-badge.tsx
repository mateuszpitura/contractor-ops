"use client";

import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Status Mapping (per UI-SPEC Status Badge Mapping)
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { variant: "warning" | "destructive" | "success" | "secondary" | "info"; label: string }
> = {
  // Contract-level signing statuses
  PENDING_SIGNATURE: { variant: "warning", label: "Pending Signature" },
  SIGNATURE_DECLINED: { variant: "destructive", label: "Signature Declined" },
  SIGNATURE_EXPIRED: { variant: "destructive", label: "Signature Expired" },

  // Per-signer statuses
  SIGNED: { variant: "success", label: "Signed" },
  AWAITING: { variant: "secondary", label: "Awaiting" },
  SENT: { variant: "info", label: "Sent" },
  DELIVERED: { variant: "info", label: "Delivered" },
  PENDING: { variant: "secondary", label: "Pending" },
  VIEWED: { variant: "info", label: "Viewed" },
  DECLINED: { variant: "destructive", label: "Declined" },

  // Envelope statuses
  COMPLETED: { variant: "success", label: "Completed" },
  VOIDED: { variant: "destructive", label: "Voided" },
  EXPIRED: { variant: "destructive", label: "Expired" },
  CREATED: { variant: "secondary", label: "Created" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type SigningStatusBadgeProps = {
  status: string;
};

/**
 * Badge component for signing-related statuses.
 * Maps status to appropriate color variant per UI-SPEC.
 */
export function SigningStatusBadge({ status }: SigningStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  if (!config) {
    return <Badge variant="secondary">{status}</Badge>;
  }

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
