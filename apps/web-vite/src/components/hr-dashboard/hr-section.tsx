import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Shared presentational scaffolding for the HR dashboard sections — a titled
 * card plus the loading / empty / degraded / error variants every widget renders.
 * Props-in → JSX-out; no data layer.
 */

interface HrSectionCardProps {
  title: string;
  description?: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

export function HrSectionCard({ title, description, headerActions, children }: HrSectionCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function HrSectionSkeleton({ title }: { title: string }) {
  return (
    <HrSectionCard title={title}>
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </HrSectionCard>
  );
}

interface HrSectionEmptyProps {
  title: string;
  icon: LucideIcon;
  heading: string;
  body: string;
}

/** Empty / degraded state — a real card, never a crash (D-04). */
export function HrSectionEmpty({ title, icon: Icon, heading, body }: HrSectionEmptyProps) {
  return (
    <HrSectionCard title={title}>
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Icon aria-hidden="true" className="size-7 text-muted-foreground" />
        <p className="text-base font-semibold">{heading}</p>
        <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      </div>
    </HrSectionCard>
  );
}

interface HrSectionErrorProps {
  title: string;
  heading: string;
  body: string;
  retryLabel: string;
  onRetry: () => void;
}

export function HrSectionError({ title, heading, body, retryLabel, onRetry }: HrSectionErrorProps) {
  return (
    <HrSectionCard title={title}>
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertTriangle aria-hidden="true" className="size-7 text-warning" />
        <p className="text-base font-semibold">{heading}</p>
        <p className="max-w-md text-sm text-muted-foreground">{body}</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    </HrSectionCard>
  );
}
