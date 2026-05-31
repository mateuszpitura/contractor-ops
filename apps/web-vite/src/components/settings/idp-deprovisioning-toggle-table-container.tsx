/**
 * Phase 77 D-15 — toggle-table container. Decides loading / error / empty vs the
 * table; the hook is the sole tRPC boundary.
 */

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useIdpDeprovisioningToggles } from './hooks/use-idp-deprovisioning-toggles.js';
import { IdpDeprovisioningToggleTable } from './idp-deprovisioning-toggle-table.js';

export function IdpDeprovisioningToggleTableContainer() {
  const t = useTranslations('Idp.toggleTable');
  const state = useIdpDeprovisioningToggles();

  if (state.isLoading) {
    return <Skeleton className="h-32 w-full" data-testid="idp-toggle-table-skeleton" />;
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
    <IdpDeprovisioningToggleTable
      rows={state.rows}
      onToggle={state.onToggle}
      pendingProvider={state.pendingProvider}
    />
  );
}
