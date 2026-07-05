/**
 * Presentational shells shared by the employee self-service sections — a titled
 * card, a section-shaped skeleton, and a centered message used for the empty,
 * error, and unavailable (dark-widget) states. Props-only; no data boundary.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../../../lib/utils.js';

interface SectionCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className,
}: SectionCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-4.5 w-4.5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {!!description && <CardDescription className="mt-0.5">{description}</CardDescription>}
          </div>
        </div>
        {!!actions && <div className="shrink-0">{actions}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader className="space-y-0">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }, (_, index) => `row-${index}`).map(key => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

interface SectionMessageProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: 'neutral' | 'danger';
  action?: ReactNode;
}

export function SectionMessage({
  icon: Icon,
  title,
  description,
  tone = 'neutral',
  action,
}: SectionMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full',
          tone === 'danger' ? 'bg-destructive/10' : 'bg-muted',
        )}>
        <Icon
          className={cn(
            'h-5 w-5',
            tone === 'danger' ? 'text-destructive' : 'text-muted-foreground',
          )}
          aria-hidden="true"
        />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {!!action && <div className="mt-2">{action}</div>}
    </div>
  );
}
