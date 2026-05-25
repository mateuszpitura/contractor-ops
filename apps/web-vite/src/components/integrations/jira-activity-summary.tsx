import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

import type { useJiraActivitySummary } from './hooks/use-jira-activity-summary.js';
import { JiraIssueChip } from './jira-issue-chip.js';
import { JiraLogo } from './jira-logo.js';

export type JiraActivitySummaryViewProps = Pick<
  ReturnType<typeof useJiraActivitySummary>,
  'items' | 'relativeTime' | 't'
>;

export function JiraActivitySummarySkeleton() {
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

export function JiraActivitySummaryView({ items, relativeTime, t }: JiraActivitySummaryViewProps) {
  return (
    <div className="animate-fade-up rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <JiraLogo className="size-4" />
        <h4 className="text-sm font-semibold">{t('title')}</h4>
      </div>

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
