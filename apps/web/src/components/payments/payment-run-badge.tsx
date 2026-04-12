'use client';

import { CheckCircle2, Download, FileEdit, Lock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Payment Run Status Badge
// ---------------------------------------------------------------------------

const runStatusConfig: Record<
  string,
  { className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  DRAFT: {
    className: 'bg-muted text-muted-foreground',
    Icon: FileEdit,
  },
  LOCKED: {
    className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    Icon: Lock,
  },
  EXPORTED: {
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    Icon: Download,
  },
  COMPLETED: {
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
    Icon: CheckCircle2,
  },
  CANCELLED: {
    className: 'bg-destructive/10 text-destructive',
    Icon: XCircle,
  },
};

interface PaymentRunBadgeProps {
  status: string;
}

export function PaymentRunBadge({ status }: PaymentRunBadgeProps) {
  const config = runStatusConfig[status];
  if (!config) {
    return <Badge variant="secondary">{status}</Badge>;
  }
  const { className, Icon } = config;
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Payment Item Status Badge
// ---------------------------------------------------------------------------

const itemStatusConfig: Record<string, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  PAID: 'bg-green-500/10 text-green-600 dark:text-green-400',
  FAILED: 'bg-destructive/10 text-destructive',
};

interface PaymentItemBadgeProps {
  status: string;
}

export function PaymentItemBadge({ status }: PaymentItemBadgeProps) {
  const className = itemStatusConfig[status] ?? '';
  return (
    <Badge variant="outline" className={className}>
      {status}
    </Badge>
  );
}
