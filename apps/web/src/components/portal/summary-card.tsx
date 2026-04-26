import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  className?: string;
}

// ---------------------------------------------------------------------------
// SummaryCard
// ---------------------------------------------------------------------------

/**
 * Overview dashboard metric card.
 *
 * Per UI-SPEC D-02: icon (20px, muted-foreground) on left,
 * label (text-[13px] font-normal text-muted-foreground) above
 * value (text-[28px] font-semibold).
 */
export function SummaryCard({ icon: Icon, label, value, className }: SummaryCardProps) {
  return (
    <Card className={cn('card-interactive p-6', className)}>
      <CardContent className="flex items-start gap-4 p-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-normal text-muted-foreground">{label}</p>
          <p className="font-display text-[28px] font-semibold leading-[1.2]">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SummaryCardSkeleton
// ---------------------------------------------------------------------------

/**
 * Loading skeleton matching SummaryCard dimensions.
 */
export function SummaryCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('p-6', className)}>
      <CardContent className="flex items-start gap-4 p-0">
        <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}
