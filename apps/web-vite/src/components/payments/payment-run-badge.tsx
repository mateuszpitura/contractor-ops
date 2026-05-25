/**
 * Payment run/item status badges. Lifted from
 * apps/web/src/components/payments/payment-run-badge.tsx unchanged
 * (consumes only @contractor-ops/ui + lucide; no Next imports).
 */

import type { PaymentRunItemStatusInput, PaymentRunStatusInput } from '@contractor-ops/ui';
import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { CheckCircle2, Download, FileEdit, Lock, XCircle } from 'lucide-react';
import type { ComponentType } from 'react';

const runStatusIcon: Record<string, ComponentType<{ className?: string }>> = {
  DRAFT: FileEdit,
  LOCKED: Lock,
  EXPORTED: Download,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
};

interface PaymentRunBadgeProps {
  status: string;
}

export function PaymentRunBadge({ status }: PaymentRunBadgeProps) {
  const Icon = runStatusIcon[status];
  const variant = statusToVariant('payment-run', status as PaymentRunStatusInput);
  return (
    <AtelierStatusPill variant={variant}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {status}
    </AtelierStatusPill>
  );
}

interface PaymentItemBadgeProps {
  status: string;
}

export function PaymentItemBadge({ status }: PaymentItemBadgeProps) {
  const variant = statusToVariant('payment-run-item', status as PaymentRunItemStatusInput);
  return <AtelierStatusPill variant={variant}>{status}</AtelierStatusPill>;
}
