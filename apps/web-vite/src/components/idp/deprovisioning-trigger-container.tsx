/**
 * Phase 81 D-02/D-03/D-06/D-09/D-10/D-11 — deprovisioning trigger container.
 *
 * Decides everything; calls the use-start-deprovisioning hook only (no direct
 * tRPC). State machine:
 *   - permission gate (D-10 UI mirror — advisory; the server re-enforces)
 *   - loading skeleton (resolver / eligibility in flight)
 *   - error + retry
 *   - not-configured / nothing-to-deprovision (D-06 — resolver returned null)
 *   - existing-run → render the existing run-view inline ("view run", D-03/D-09)
 *   - cooldown-disabled → disabled button + earliest-date tooltip (D-11)
 *   - startable → the start button opening the confirm dialog (D-02)
 *
 * Reuses (does NOT rebuild) ImpactPreviewPanelContainer + DeprovisioningRunViewContainer.
 */

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

import { usePermissions } from '../../hooks/use-permissions.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { DeprovisioningRunViewContainer } from './deprovisioning-run-view-container.js';
import { DeprovisioningTrigger } from './deprovisioning-trigger.js';
import type { UseStartDeprovisioningInput } from './hooks/use-start-deprovisioning.js';
import { useStartDeprovisioning } from './hooks/use-start-deprovisioning.js';
import { ImpactPreviewPanelContainer } from './impact-preview-panel-container.js';

export type DeprovisioningTriggerContainerProps = UseStartDeprovisioningInput;

function formatEarliest(earliestDate: Date | string | null): string | null {
  if (!earliestDate) return null;
  const d = earliestDate instanceof Date ? earliestDate : new Date(earliestDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function DeprovisioningTriggerContainer(props: DeprovisioningTriggerContainerProps) {
  const t = useTranslations('Idp.trigger');
  const permissions = usePermissions();
  const canStart = permissions.can('idp', ['start_run']);
  const state = useStartDeprovisioning(props);

  // D-10 UI gate — hide the trigger entirely for users without the action.
  // The server re-enforces requirePermission({ idp: ['start_run'] }) regardless.
  if (!canStart) return null;

  if (state.isLoading) {
    return <Skeleton className="h-9 w-32" data-testid="deprovisioning-trigger-skeleton" />;
  }

  if (state.isError) {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/40 p-3" role="alert">
        <p className="text-sm text-destructive">{t('error')}</p>
        <button type="button" className="text-sm underline" onClick={state.onRetry}>
          {t('retry')}
        </button>
      </div>
    );
  }

  // D-06 — no ENDED assignment to act on (or integration not configured).
  if (state.isUnresolved || !state.assignmentId) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t('notConfigured')}
      </p>
    );
  }

  // D-03/D-09 — a run already exists for this assignment: show it in place
  // rather than a second "start" button.
  if (state.startedRunId) {
    return (
      <div className="space-y-2" data-testid="deprovisioning-run-inline">
        <p className="text-sm font-medium text-muted-foreground" role="status">
          {t('viewRun')}
        </p>
        <DeprovisioningRunViewContainer runId={state.startedRunId} />
      </div>
    );
  }

  const earliest = formatEarliest(state.earliestDate);
  const disabled = !state.allowed || state.isStarting;

  return (
    <DeprovisioningTrigger
      disabled={disabled}
      disabledTooltip={
        state.allowed
          ? null
          : earliest
            ? t('cooldownTooltip', { date: earliest })
            : (state.reason ?? t('cooldownTooltipGeneric'))
      }
      confirmOpen={state.confirmOpen}
      onOpenConfirm={state.openConfirm}
      onCloseConfirm={state.closeConfirm}
      onConfirmStart={state.start}
      starting={state.isStarting}
      previewSlot={
        <ImpactPreviewPanelContainer
          assignmentId={state.assignmentId}
          provider="GOOGLE_WORKSPACE"
        />
      }
    />
  );
}
