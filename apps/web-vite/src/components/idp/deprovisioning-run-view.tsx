/**
 * Presentational saga run/step view. Per-step rows show the status (incl. the
 * MANUAL_COMPLETED override badge), the per-failed-step "Mark complete" button
 * (only when the step is overridable), and the override dialog.
 * Props-in / JSX-out; the container owns loading/empty/error.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

import { usePermissions } from '../../hooks/use-permissions.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { DeprovisioningStepView } from './hooks/use-deprovisioning-run.js';
import { useDeprovisioningRun } from './hooks/use-deprovisioning-run.js';
import type { ManualOverrideCategory } from './override-step-dialog.js';
import { OverrideStepDialog } from './override-step-dialog.js';
import { StepOverrideBadge } from './step-override-badge.js';

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'SUCCEEDED':
      return 'default';
    case 'MANUAL_COMPLETED':
      return 'secondary';
    case 'FAILED':
      return 'destructive';
    default:
      return 'outline';
  }
}

export interface DeprovisioningRunViewProps {
  steps: DeprovisioningStepView[];
  overrideStepId: string | null;
  onOpenOverride: (stepId: string | null) => void;
  onSubmitOverride: (input: {
    stepId: string;
    category: ManualOverrideCategory;
    note: string;
  }) => Promise<void>;
  overridePending: boolean;
  overrideServerError?: string;
}

export function DeprovisioningRunView({
  steps,
  overrideStepId,
  onOpenOverride,
  onSubmitOverride,
  overridePending,
  overrideServerError,
}: DeprovisioningRunViewProps) {
  const t = useTranslations('Idp.runView');

  return (
    <>
      <ul className="divide-y rounded-lg border">
        {steps.map(step => (
          <li key={step.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t(`provider.${step.provider}`)}</span>
                <span className="text-sm text-muted-foreground">
                  {t(`stepKind.${step.stepKind}`)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusBadgeVariant(step.status)}>
                  {t(`status.${step.status}`)}
                </Badge>
                {step.status === 'MANUAL_COMPLETED' ? (
                  <StepOverrideBadge
                    category={step.manualOverrideCategory}
                    note={step.manualOverrideNote}
                    overriddenByUserId={step.manualOverriddenByUserId}
                    overriddenAt={step.manualOverriddenAt}
                  />
                ) : null}
                {step.status === 'FAILED' && step.lastErrorMessage ? (
                  <span className="text-xs text-destructive">{step.lastErrorMessage}</span>
                ) : null}
              </div>
            </div>
            {step.canMarkComplete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenOverride(step.id)}>
                {t('markComplete')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {overrideStepId ? (
        <OverrideStepDialog
          stepId={overrideStepId}
          open={overrideStepId !== null}
          onOpenChange={open => onOpenOverride(open ? overrideStepId : null)}
          onSubmit={onSubmitOverride}
          pending={overridePending}
          serverError={overrideServerError}
        />
      ) : null}
    </>
  );
}

export interface DeprovisioningRunViewWiredProps {
  runId: string;
}

export function DeprovisioningRunViewWired({ runId }: DeprovisioningRunViewWiredProps) {
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
