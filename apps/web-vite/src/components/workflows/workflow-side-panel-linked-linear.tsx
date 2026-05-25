import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useTranslations } from '../../i18n/useTranslations.js';
import { LinearIssueChip } from '../integrations/linear-issue-chip.js';
import type { useSidePanelLinkedLinear } from './hooks/use-side-panel-linked-linear.js';

type LinkedLinearIssuesViewProps = ReturnType<typeof useSidePanelLinkedLinear>;

/**
 * Presentational linked-Linear-issues section for the workflow side panel.
 */
export function LinkedLinearIssuesView({
  showSection,
  isLoading,
  isError,
  issues,
  handleRetry,
}: LinkedLinearIssuesViewProps) {
  const ts = useTranslations('Workflows.sidePanel');
  const t = useTranslations('Workflows');
  const tCommon = useTranslations('Common');

  if (!showSection) return null;

  return (
    <>
      <Separator />
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {ts('linearIssues')}
        </h3>

        {isError ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              {t('errors.retry')}
            </Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <div key={`wf-linear-${i}`} className="flex items-center gap-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-6 w-[120px] rounded-md" />
              </div>
            ))}
          </div>
        ) : (
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
        )}
      </div>
    </>
  );
}
