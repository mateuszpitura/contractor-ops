import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { ReactNode } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { LinearIssueChip } from '../integrations/linear-issue-chip.js';
import type { LinkedLinearIssueRow } from './hooks/use-side-panel-linked-linear.js';
import { useSidePanelLinkedLinear } from './hooks/use-side-panel-linked-linear.js';

interface LinkedLinearIssuesSectionShellProps {
  children: ReactNode;
}

export function LinkedLinearIssuesSectionShell({ children }: LinkedLinearIssuesSectionShellProps) {
  const ts = useTranslations('Workflows.sidePanel');
  return (
    <>
      <Separator />
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {ts('linearIssues')}
        </h3>
        {children}
      </div>
    </>
  );
}

const LINEAR_SKELETON_KEYS = ['issue-a', 'issue-b'] as const;

export function LinkedLinearIssuesSkeleton() {
  return (
    <div className="space-y-2">
      {LINEAR_SKELETON_KEYS.map(key => (
        <div key={key} className="flex items-center gap-2">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-6 w-[120px] rounded-md" />
        </div>
      ))}
    </div>
  );
}

interface LinkedLinearIssuesErrorProps {
  onRetry: () => void;
}

export function LinkedLinearIssuesError({ onRetry }: LinkedLinearIssuesErrorProps) {
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

export function LinkedLinearIssuesEmpty() {
  const ts = useTranslations('Workflows.sidePanel');
  return <p className="text-sm text-muted-foreground">{ts('noLinkedLinearIssues')}</p>;
}

interface LinkedLinearIssuesListProps {
  issues: LinkedLinearIssueRow[];
}

export function LinkedLinearIssuesList({ issues }: LinkedLinearIssuesListProps) {
  return (
    <div className="space-y-2">
      {issues.map(issue => (
        <div key={issue.id} className="flex items-center gap-2">
          <LinearIssueChip
            identifier={issue.metadataJson.identifier}
            title={issue.metadataJson.title}
            status={issue.metadataJson.status}
            statusType={issue.metadataJson.statusType}
            url={issue.metadataJson.url ?? issue.externalUrl}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Legacy combined view kept for direct consumers that build the full props
 * bag; presentational only — single render path per variant.
 */
interface LinkedLinearIssuesViewProps {
  showSection: boolean;
  isLoading: boolean;
  isError: boolean;
  issues: LinkedLinearIssueRow[];
  handleRetry: () => void;
}

export function LinkedLinearIssuesView({
  showSection,
  isLoading,
  isError,
  issues,
  handleRetry,
}: LinkedLinearIssuesViewProps) {
  if (!showSection) return null;

  let body: ReactNode;
  if (isError) {
    body = <LinkedLinearIssuesError onRetry={handleRetry} />;
  } else if (isLoading) {
    body = <LinkedLinearIssuesSkeleton />;
  } else if (issues.length === 0) {
    body = <LinkedLinearIssuesEmpty />;
  } else {
    body = <LinkedLinearIssuesList issues={issues} />;
  }

  return <LinkedLinearIssuesSectionShell>{body}</LinkedLinearIssuesSectionShell>;
}

interface LinkedLinearIssuesSectionProps {
  runId: string;
}

export function LinkedLinearIssuesSection({ runId }: LinkedLinearIssuesSectionProps) {
  const { showSection, isLoading, isError, issues, handleRetry } = useSidePanelLinkedLinear(runId);

  if (!showSection) return null;

  let body: ReactNode;
  if (isError) {
    body = <LinkedLinearIssuesError onRetry={handleRetry} />;
  } else if (isLoading) {
    body = <LinkedLinearIssuesSkeleton />;
  } else if (issues.length === 0) {
    body = <LinkedLinearIssuesEmpty />;
  } else {
    body = <LinkedLinearIssuesList issues={issues} />;
  }

  return <LinkedLinearIssuesSectionShell>{body}</LinkedLinearIssuesSectionShell>;
}
