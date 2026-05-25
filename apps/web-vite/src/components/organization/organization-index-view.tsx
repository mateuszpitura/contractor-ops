import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface SummaryCardItem {
  href: string;
  label: string;
  count: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
}

interface SummaryCardProps extends SummaryCardItem {}

function SummaryCard({ href, label, count, icon: Icon }: SummaryCardProps) {
  return (
    <Link
      to={href}
      relative="path"
      className="focus-visible:ring-ring rounded-lg focus-visible:outline-none focus-visible:ring-2">
      <Card className="hover:border-foreground/30 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <Icon className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent className="flex items-end justify-between">
          <div className="text-2xl font-semibold tabular-nums">{count ?? '—'}</div>
          <ArrowRight className="text-muted-foreground h-4 w-4" />
        </CardContent>
      </Card>
    </Link>
  );
}

interface OrganizationIndexViewProps {
  items: SummaryCardItem[];
}

export function OrganizationIndexView({ items }: OrganizationIndexViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {items.map(item => (
        <SummaryCard key={item.href} {...item} />
      ))}
    </div>
  );
}

export function OrganizationIndexSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-busy="true" aria-live="polite">
      {[0, 1, 2].map(i => (
        <Card key={i} className="border-foreground/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
