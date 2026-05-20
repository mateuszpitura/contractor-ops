'use client';

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { trpc } from '@/trpc/init';
import { JiraIssueChip } from './jira-issue-chip';
import { JiraLogo } from './jira-logo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentActivityItem {
  id: string;
  externalId: string;
  externalUrl: string;
  metadataJson: {
    key: string;
    summary: string;
    status: string;
    statusCategory: 'new' | 'indeterminate' | 'done';
    url: string;
  };
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface JiraActivitySummaryProps {
  contractorId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JiraActivitySummary({ contractorId }: JiraActivitySummaryProps) {
  const t = useTranslations('Integrations.jira.activitySummary');
  const activityQuery = useQuery(trpc.jira.recentActivity.queryOptions({ contractorId, limit: 5 }));

  const relativeTime = (dateStr: string): string => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;

    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return t('relativeTime.justNow');
    if (minutes < 60) return t('relativeTime.minutesAgo', { n: minutes });

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('relativeTime.hoursAgo', { n: hours });

    const days = Math.floor(hours / 24);
    if (days < 30) return t('relativeTime.daysAgo', { n: days });

    const months = Math.floor(days / 30);
    return t('relativeTime.monthsAgo', { n: months });
  };

  const items = (activityQuery.data ?? []) as unknown as RecentActivityItem[];

  // Loading state: 3 skeleton rows
  if (activityQuery.isLoading) {
    return (
      <div className="animate-fade-up rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`activity-${i}`} className="flex items-center gap-2">
            <Skeleton className="h-6 w-[120px] rounded-md" />
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="ms-auto h-3 w-[60px]" />
          </div>
        ))}
      </div>
    );
  }

  // Don't render if no data
  if (!items.length) return null;

  return (
    <div className="animate-fade-up rounded-lg border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <JiraLogo className="size-4" />
        <h4 className="text-sm font-semibold">{t('title')}</h4>
      </div>

      {/* Activity list */}
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2">
            <JiraIssueChip
              issueKey={item.metadataJson.key}
              summary={item.metadataJson.summary}
              status={item.metadataJson.status}
              statusCategory={item.metadataJson.statusCategory}
              url={item.metadataJson.url ?? item.externalUrl}
            />
            <span className="flex-1 mx-2 text-sm text-muted-foreground truncate">
              {item.metadataJson.summary}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {relativeTime(item.updatedAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
