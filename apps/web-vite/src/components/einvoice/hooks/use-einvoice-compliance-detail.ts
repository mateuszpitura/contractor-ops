import { complianceState } from '@contractor-ops/einvoice/compliance';
import { useQuery } from '@tanstack/react-query';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useEinvoiceComplianceDetail() {
  const trpc = useTRPC();
  const t = useTranslations('EInvoice.ComplianceDetail');

  const complianceQuery = useQuery(trpc.einvoice.complianceStatuses.queryOptions());

  const stateLabels: Record<string, string> = {
    active: t('stateActive'),
    sandbox: t('stateSandbox'),
    degraded: t('stateDegraded'),
    onboarding: t('stateOnboarding'),
    suspended: t('stateSuspended'),
    error: t('stateError'),
    [complianceState.notConnected]: t('stateNotConnected'),
  };

  function formatTimeAgo(date: Date | string | undefined): string {
    if (!date) return t('timeNever');
    const d = typeof date === 'string' ? new Date(date) : date;
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return t('timeJustNow');
    if (diffMins < 60) return t('timeMinutesAgo', { minutes: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('timeHoursAgo', { hours: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    return t('timeDaysAgo', { days: diffDays });
  }

  return {
    isLoading: complianceQuery.isLoading,
    statuses: complianceQuery.data?.statuses ?? [],
    stateLabels,
    formatTimeAgo,
    t,
  } as const;
}
