/**
 * Phase 77 — saga run-view container. Decides: loading skeleton / error / empty /
 * the step list. Reads the idp:override_step_failure permission (UI gate; the
 * server mutation is the authoritative gate) and forwards it into the hook.
 */

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

import { usePermissions } from '../../hooks/use-permissions.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { DeprovisioningRunView } from './deprovisioning-run-view.js';
import { useDeprovisioningRun } from './hooks/use-deprovisioning-run.js';

export interface DeprovisioningRunViewContainerProps {
  runId: string;
}

export function DeprovisioningRunViewContainer({ runId }: DeprovisioningRunViewContainerProps) {
  const t = useTranslations('Idp.runView');
  const permissions = usePermissions();
  const canOverride = permissions.can('idp', ['override_step_failure']);
  const state = useDeprovisioningRun(runId, canOverride);

  if (state.isLoading) {
    return <Skeleton className="h-48 w-full" data-testid="run-view-skeleton" />;
  }
  if (state.isError) {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/40 p-4" role="alert">
        <p className="text-sm text-destructive">{t('error')}</p>
        <button type="button" className="text-sm underline" onClick={state.onRetry}>
          {t('retry')}
        </button>
      </div>
    );
  }
  if (state.isEmpty) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t('empty')}
      </p>
    );
  }

  return (
    <DeprovisioningRunView
      steps={state.steps}
      overrideStepId={state.overrideStepId}
      onOpenOverride={state.setOverrideStepId}
      onSubmitOverride={state.handleOverrideSubmit}
      overridePending={state.overridePending}
      overrideServerError={state.overrideServerError}
    />
  );
}
