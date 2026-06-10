/**
 * Refresh dashboard button.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { RotateCw } from 'lucide-react';
import { useCallback } from 'react';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useClassificationDashboardRefreshButton } from '../hooks/use-classification-dashboard.js';

export type RefreshDashboardButtonViewProps = {
  onRefresh: () => Promise<void>;
  busy: boolean;
  announcement: string;
};

export function RefreshDashboardButtonView({
  onRefresh,
  busy,
  announcement,
}: RefreshDashboardButtonViewProps) {
  const t = useTranslations('Classification.polish.dashboard');

  const handleRefreshClick = useCallback(() => {
    void onRefresh();
  }, [onRefresh]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={handleRefreshClick}
        aria-label={t('refreshButton')}
        data-testid="refresh-dashboard-button">
        <RotateCw aria-hidden="true" className={busy ? 'size-4 animate-spin' : 'size-4'} />
        <span>{busy ? t('refreshingLabel') : t('refreshButton')}</span>
      </Button>
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="refresh-announcement">
        {announcement}
      </span>
    </>
  );
}

export function RefreshDashboardButton() {
  const refresh = useClassificationDashboardRefreshButton();
  return <RefreshDashboardButtonView {...refresh} />;
}
