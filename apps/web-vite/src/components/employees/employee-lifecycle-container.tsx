/**
 * Container for the employee lifecycle surface: calls the sole-boundary hook and
 * renders the section loading / error states, then hands presentational props to
 * the panel. No direct tRPC here (the hook owns it) — keeps the data-layer guard
 * green.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useParams } from 'react-router-dom';

import { useTranslations } from '../../i18n/useTranslations.js';
import { EmployeeLifecyclePanel } from './employee-lifecycle-panel.js';
import { useEmployeeLifecycle } from './hooks/use-employee-lifecycle.js';

export function EmployeeLifecycleContainer({ workerId }: { workerId: string }) {
  const t = useTranslations('EmployeeLifecycle');
  const { locale } = useParams();
  const lc = useEmployeeLifecycle(workerId);

  if (lc.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" data-testid="employee-lifecycle-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (lc.isError) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/40 p-4" role="alert">
        <p className="text-sm text-destructive">{t('errors.load')}</p>
        <Button type="button" variant="outline" onClick={lc.retry}>
          {t('errors.retry')}
        </Button>
      </div>
    );
  }

  return (
    <EmployeeLifecyclePanel
      workerId={lc.workerId}
      displayName={lc.displayName ?? t('unknownEmployee')}
      employmentStatus={lc.employmentStatus}
      terminatedAt={lc.terminatedAt}
      startedRunIds={lc.startedRunIds}
      certDownloadUrl={lc.certDownloadUrl}
      workflowHref={runId => `/${locale ?? 'en'}/workflows/${runId}`}
      onStartOnboarding={lc.startOnboarding}
      onStartOffboarding={lc.startOffboarding}
      onRecordTermination={lc.recordTermination}
      onGenerateCert={lc.generateCert}
      isStartingOnboarding={lc.isStartingOnboarding}
      isStartingOffboarding={lc.isStartingOffboarding}
      isRecordingTermination={lc.isRecordingTermination}
      isGeneratingCert={lc.isGeneratingCert}
    />
  );
}
