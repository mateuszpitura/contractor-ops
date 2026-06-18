import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ExternalLink } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useLinearLinkedIssuesPanel } from '../hooks/use-linear-linked-issues-panel.js';

type LinearLinkedIssue = {
  id: string;
  externalId: string;
  externalUrl: string | null;
  metadata: {
    identifier: string;
    title: string;
    status: string;
    statusType: string;
    url: string;
  } | null;
};

interface LinearLinkedIssuesPanelProps {
  heading?: string;
  isLoading: boolean;
  items: Array<{ taskRunId: string; issue: LinearLinkedIssue }>;
}

const LINKED_ISSUE_SKELETON_KEYS = ['row-1', 'row-2'] as const;

/**
 * Renders Linear issues linked to a given set of workflow task runs.
 *
 * NOTE: Inline minimal chip until `components/integrations/linear-issue-chip` +
 * `linear-logo` are lifted into apps/web-vite in their own batch.
 */
export function LinearLinkedIssuesPanel({
  heading,
  isLoading,
  items,
}: LinearLinkedIssuesPanelProps) {
  const t = useTranslations('Integrations.linear.linkedIssuesPanel');

  if (isLoading) {
    return (
      <div className="animate-fade-up rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        {LINKED_ISSUE_SKELETON_KEYS.map(key => (
          <div key={key} className="flex items-center gap-2">
            <Skeleton className="h-6 w-[140px] rounded-md" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="animate-fade-up rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ExternalLink className="size-4" aria-hidden="true" />
        <h4 className="text-sm font-semibold">{heading ?? t('title')}</h4>
        <span className="ms-auto text-xs text-muted-foreground">
          {t('count', { count: items.length })}
        </span>
      </div>

      <ul className="space-y-2">
        {items.map(({ taskRunId, issue }) => {
          const metadata = issue.metadata;
          if (!metadata) return null;
          const href = metadata.url ?? issue.externalUrl ?? '#';
          return (
            <li key={taskRunId} className="flex items-center gap-2">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-mono hover:bg-muted">
                {metadata.identifier}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
              <span className="flex-1 mx-2 text-sm text-muted-foreground truncate">
                {metadata.title}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type LinearLinkedIssuesPanelWiredProps = {
  taskRunIds: string[];
  heading?: string;
  maxRows?: number;
};

export function LinearLinkedIssuesPanelWired({
  taskRunIds,
  heading,
  maxRows,
}: LinearLinkedIssuesPanelWiredProps) {
  const panel = useLinearLinkedIssuesPanel(taskRunIds, maxRows);

  if (!panel.isVisible) return null;

  return (
    <LinearLinkedIssuesPanel heading={heading} isLoading={panel.isLoading} items={panel.items} />
  );
}
