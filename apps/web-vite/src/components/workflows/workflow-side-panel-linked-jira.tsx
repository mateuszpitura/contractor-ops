import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { ReactNode } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { JiraIssueChip } from '../integrations/jira-issue-chip.js';
import type { LinkedJiraIssueRow } from './hooks/use-side-panel-linked-jira.js';
import { useSidePanelLinkedJira } from './hooks/use-side-panel-linked-jira.js';

interface LinkedJiraIssuesSectionShellProps {
  children: ReactNode;
}

export function LinkedJiraIssuesSectionShell({ children }: LinkedJiraIssuesSectionShellProps) {
  const ts = useTranslations('Workflows.sidePanel');
  return (
    <>
      <Separator />
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {ts('linkedIssues')}
        </h3>
        {children}
      </div>
    </>
  );
}

const JIRA_SKELETON_KEYS = ['j1', 'j2'] as const;

export function LinkedJiraIssuesSkeleton() {
  return (
    <div className="space-y-2">
      {JIRA_SKELETON_KEYS.map(key => (
        <div key={key} className="flex items-center gap-2">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-6 w-[120px] rounded-md" />
        </div>
      ))}
    </div>
  );
}

interface LinkedJiraIssuesErrorProps {
  onRetry: () => void;
}

export function LinkedJiraIssuesError({ onRetry }: LinkedJiraIssuesErrorProps) {
  const t = useTranslations('Workflows');
  const tCommon = useTranslations('Common');
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t('errors.retry')}
      </Button>
    </div>
  );
}

export function LinkedJiraIssuesEmpty() {
  const ts = useTranslations('Workflows.sidePanel');
  return <p className="text-sm text-muted-foreground">{ts('noLinkedJiraIssues')}</p>;
}

interface LinkedJiraIssuesListProps {
  issues: LinkedJiraIssueRow[];
}

export function LinkedJiraIssuesList({ issues }: LinkedJiraIssuesListProps) {
  return (
    <div className="space-y-2">
      {issues.map(issue => (
        <div key={issue.id} className="flex items-center gap-2">
          <JiraIssueChip
            issueKey={issue.metadataJson.key}
            summary={issue.metadataJson.summary}
            status={issue.metadataJson.status}
            statusCategory={issue.metadataJson.statusCategory}
            url={issue.metadataJson.url ?? issue.externalUrl}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Legacy combined view kept for any direct consumer that constructs the
 * full props bag; presentational only — single render path per variant.
 */
interface LinkedJiraIssuesViewProps {
  showSection: boolean;
  isLoading: boolean;
  isError: boolean;
  issues: LinkedJiraIssueRow[];
  handleRetry: () => void;
}

export function LinkedJiraIssuesView({
  showSection,
  isLoading,
  isError,
  issues,
  handleRetry,
}: LinkedJiraIssuesViewProps) {
  if (!showSection) return null;

  let body: ReactNode;
  if (isError) {
    body = <LinkedJiraIssuesError onRetry={handleRetry} />;
  } else if (isLoading) {
    body = <LinkedJiraIssuesSkeleton />;
  } else if (issues.length === 0) {
    body = <LinkedJiraIssuesEmpty />;
  } else {
    body = <LinkedJiraIssuesList issues={issues} />;
  }

  return <LinkedJiraIssuesSectionShell>{body}</LinkedJiraIssuesSectionShell>;
}

interface LinkedJiraIssuesSectionProps {
  runId: string;
}

export function LinkedJiraIssuesSection({ runId }: LinkedJiraIssuesSectionProps) {
  const { showSection, isLoading, isError, issues, handleRetry } = useSidePanelLinkedJira(runId);

  if (!showSection) return null;

  let body: ReactNode;
  if (isError) {
    body = <LinkedJiraIssuesError onRetry={handleRetry} />;
  } else if (isLoading) {
    body = <LinkedJiraIssuesSkeleton />;
  } else if (issues.length === 0) {
    body = <LinkedJiraIssuesEmpty />;
  } else {
    body = <LinkedJiraIssuesList issues={issues} />;
  }

  return <LinkedJiraIssuesSectionShell>{body}</LinkedJiraIssuesSectionShell>;
}
