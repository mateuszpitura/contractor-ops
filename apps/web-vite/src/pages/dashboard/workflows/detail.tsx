import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { CredentialsTabSection } from '../../../components/workflow/credentials-tab.js';
import { useWorkflowRunDetail } from '../../../components/workflows/hooks/use-workflow-run-detail.js';
import { RunHeaderSection } from '../../../components/workflows/workflow-run/run-header.js';
import { TaskChecklist } from '../../../components/workflows/workflow-run/task-checklist.js';
import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

function RunDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-2 w-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-16" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`skel-${i}`} className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <Skeleton className="size-5 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkflowRunDetailPageContent() {
  const params = useParams<{ id: string }>();
  const runId = params.id ?? '';
  const t = useTranslations('Workflows');
  const { run, currentUserId, handleRetry, isNotFound, isError, isLoading } =
    useWorkflowRunDetail(runId);

  if (isError) {
    if (isNotFound) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
          <h2 className="text-lg font-medium">{t('notFound')}</h2>
          <Button variant="outline" render={<Link href="/workflows" />}>
            {t('backToWorkflows')}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">{t('errors.failedToLoadWorkflowDetail')}</h2>
        <Button variant="outline" onClick={handleRetry}>
          {t('errors.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isLoading || !run ? (
        <RunDetailSkeleton />
      ) : (
        <>
          <RunHeaderSection run={run} />
          <TaskChecklist
            tasks={run.tasks}
            runId={run.id}
            currentUserId={currentUserId}
            contractorId={run.contractorId}
          />
          {run.workflowTemplate?.type === 'OFFBOARDING' && (
            <CredentialsTabSection workflowRunId={run.id} />
          )}
        </>
      )}
    </div>
  );
}

export default function WorkflowRunDetailPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <WorkflowRunDetailPageContent />
    </Suspense>
  );
}
