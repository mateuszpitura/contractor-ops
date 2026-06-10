import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { CheckCircle, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useCallback } from 'react';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { OnboardingProgressData } from './hooks/use-onboarding-progress.js';
import { useOnboardingProgress } from './hooks/use-onboarding-progress.js';

const PROJECT_FAILED_PREFIX = 'project:';

interface FailedItemRowProps {
  email: string;
  error: string;
  isRetrying: boolean;
  retryLabel: string;
  projectLabel: (name: string) => string;
  onRetry: (email: string) => void;
}

function FailedItemRow({
  email,
  error,
  isRetrying,
  retryLabel,
  projectLabel,
  onRetry,
}: FailedItemRowProps) {
  const handleRetry = useCallback(() => onRetry(email), [email, onRetry]);
  const isProjectFailure = email.startsWith(PROJECT_FAILED_PREFIX);
  const displayLabel = isProjectFailure
    ? projectLabel(email.slice(PROJECT_FAILED_PREFIX.length))
    : email;
  return (
    <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
      <div className="flex items-center gap-2">
        <XCircle className="size-4 text-destructive" aria-hidden="true" />
        <div>
          <span className="text-sm font-medium">{displayLabel}</span>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
      {!isProjectFailure && (
        <Button variant="ghost" size="sm" onClick={handleRetry} disabled={isRetrying}>
          {isRetrying ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : retryLabel}
        </Button>
      )}
    </div>
  );
}

export interface ImportProgressTrackerViewProps {
  progress: OnboardingProgressData;
  isFailed: boolean;
  percentDone: number;
  onRetry: (email: string) => void;
  retryingItemKey: string | null;
}

export function ImportProgressTrackerView({
  progress,
  isFailed,
  percentDone,
  onRetry,
  retryingItemKey,
}: ImportProgressTrackerViewProps) {
  const t = useTranslations('OnboardingImport.step4');
  const projectLabel = useCallback(
    (name: string) => t('failedItemProject', { name }),
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t('progressLabel', {
              current: progress.completedItems,
              total: progress.totalItems,
            })}
          </span>
          <span className="font-medium">{percentDone}%</span>
        </div>
        <Progress value={percentDone} aria-valuenow={percentDone} aria-valuemin={0} aria-valuemax={100} />
      </div>

      {(isFailed || progress.failedItems.length > 0) && (
        <div className="space-y-2">
          {progress.failedItems.map(item => (
            <FailedItemRow
              key={item.email}
              email={item.email}
              error={item.error}
              isRetrying={retryingItemKey === item.email}
              retryLabel={t('retryButton')}
              projectLabel={projectLabel}
              onRetry={onRetry}
            />
          ))}
        </div>
      )}

      {!isFailed && progress.completedItems < progress.totalItems && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>{t('processing')}</span>
        </div>
      )}
    </div>
  );
}

export interface ImportProgressErrorProps {
  onRefetch: () => void;
}

export function ImportProgressError({ onRefetch }: ImportProgressErrorProps) {
  const tCommon = useTranslations('Common');
  const tErr = useTranslations('Contractors.error');

  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onRefetch}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {tErr('retry')}
      </Button>
    </div>
  );
}

export function ImportProgressLoading() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
    </div>
  );
}

export interface ImportProgressCompleteProps {
  importedCount: number;
  projectsCount: number;
  partial?: boolean;
}

export function ImportProgressComplete({
  importedCount,
  projectsCount,
  partial = false,
}: ImportProgressCompleteProps) {
  const t = useTranslations('OnboardingImport.step4');
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-4 py-8">
        <CheckCircle className="size-12 text-green-600" aria-hidden="true" />
        <h3 className="text-lg font-semibold">{t('completeHeading')}</h3>
        <p className="text-center text-sm text-muted-foreground">
          {partial
            ? t('partialCompleteBody', {
                imported: importedCount,
                projects: projectsCount,
              })
            : t('completeBody', {
                imported: importedCount,
                projects: projectsCount,
              })}
        </p>
        <Button render={<Link href="/dashboard" />}>{t('completeCta')}</Button>
      </CardContent>
    </Card>
  );
}

type ImportProgressTrackerProps = {
  jobId: string;
  expectedPeopleCount: number;
  expectedProjectsCount: number;
};

function deriveCompletedImportCounts(
  progress: OnboardingProgressData,
  expectedPeopleCount: number,
  expectedProjectsCount: number,
) {
  const failedPeople = progress.failedItems.filter(item => !item.email.startsWith('project:')).length;
  const failedProjects = progress.failedItems.filter(item => item.email.startsWith('project:')).length;
  return {
    peopleCount: Math.max(0, expectedPeopleCount - failedPeople),
    projectsCount: Math.max(0, expectedProjectsCount - failedProjects),
  };
}

export function ImportProgressTracker({
  jobId,
  expectedPeopleCount,
  expectedProjectsCount,
}: ImportProgressTrackerProps) {
  const section = useOnboardingProgress({ jobId });

  if (section.isError) {
    return <ImportProgressError onRefetch={section.handleRefetch} />;
  }

  if (!(section.hasData && section.progress)) {
    return <ImportProgressLoading />;
  }

  if (section.progress.failedItems.length === 0 && section.progress.completedItems > 0) {
    const { peopleCount, projectsCount } = deriveCompletedImportCounts(
      section.progress,
      expectedPeopleCount,
      expectedProjectsCount,
    );
    return <ImportProgressComplete importedCount={peopleCount} projectsCount={projectsCount} />;
  }

  const jobFinished =
    section.progress.status === 'completed' || section.progress.status === 'failed';
  const hasSuccessfulItems = section.progress.completedItems > 0;
  const hasRemainingFailures = section.progress.failedItems.length > 0;

  if (jobFinished && hasSuccessfulItems) {
    const { peopleCount, projectsCount } = deriveCompletedImportCounts(
      section.progress,
      expectedPeopleCount,
      expectedProjectsCount,
    );
    const completeCard = (
      <ImportProgressComplete
        importedCount={peopleCount}
        projectsCount={projectsCount}
        partial={hasRemainingFailures}
      />
    );

    if (hasRemainingFailures) {
      return (
        <div className="space-y-6">
          {completeCard}
          <ImportProgressTrackerView
            progress={section.progress}
            isFailed={section.isFailed}
            percentDone={section.percentDone}
            onRetry={section.handleRetry}
            retryingItemKey={section.retryingItemKey}
          />
        </div>
      );
    }

    return completeCard;
  }

  return (
    <ImportProgressTrackerView
      progress={section.progress}
      isFailed={section.isFailed}
      percentDone={section.percentDone}
      onRetry={section.handleRetry}
      retryingItemKey={section.retryingItemKey}
    />
  );
}

/** @deprecated Use ImportProgressTracker */
export { ImportProgressTracker as ImportProgressTrackerContainer };

/** @deprecated Use ImportProgressTrackerViewProps */
export type { ImportProgressTrackerViewProps as ImportProgressTrackerProps };
