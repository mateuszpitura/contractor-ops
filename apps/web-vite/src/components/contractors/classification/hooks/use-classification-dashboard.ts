import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';
import { useFlag } from '../../../layout/feature-flag-context.js';

export function useClassificationDashboardGlobalHeader() {
  const trpc = useTRPC();
  const header = useQuery(trpc.classificationDashboard!.globalHeader.queryOptions());

  return {
    isLoading: header.isPending && !header.data,
    data: header.data,
  } as const;
}

export function useClassificationDashboard() {
  const trpc = useTRPC();
  const classificationEnabled = useFlag('module.classification-engine');
  const orgConfig = useQuery(trpc.contractor.getCountryFieldsConfig.queryOptions());

  const jurisdiction = orgConfig.data?.countryCode ?? 'GB';

  return {
    classificationEnabled,
    jurisdiction,
    isOrgConfigLoading: orgConfig.isPending && !orgConfig.data,
  } as const;
}

export function useClassificationGlobalHeaderDisplay(
  lastScannedAt: string | Date | null | undefined,
) {
  const t = useTranslations('Classification.polish.dashboard');

  const lastScannedDisplay = lastScannedAt
    ? formatDistanceToNow(lastScannedAt instanceof Date ? lastScannedAt : new Date(lastScannedAt), {
        addSuffix: true,
        locale: undefined,
      })
    : t('lastScannedNever');

  return { lastScannedDisplay } as const;
}

export function useClassificationMarketCard(market: 'GB' | 'DE') {
  const trpc = useTRPC();

  const coverage = useQuery(
    trpc.classificationDashboard!.coverageByMarket.queryOptions({ market }),
  );
  const riskDistribution = useQuery(
    trpc.classificationDashboard!.riskDistributionByMarket.queryOptions({ market }),
  );
  const overdue = useQuery(trpc.classificationDashboard!.overdueByMarket.queryOptions({ market }));
  const activeAlerts = useQuery(
    trpc.classificationDashboard!.activeAlertsByMarket.queryOptions({ market }),
  );

  return { coverage, riskDistribution, overdue, activeAlerts } as const;
}

export function useClassificationDashboardCsvExport(market: 'GB' | 'DE') {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Classification.polish.dashboard');

  const mutation = useMutation(
    trpc.classificationDashboard!.exportMarketCsv.mutationOptions({
      onSuccess: (result: { url: string }) => {
        if (typeof window !== 'undefined') {
          const anchor = document.createElement('a');
          anchor.href = result.url;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        }
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.classificationDashboard!.pathFilter());
      },
      onError: () => {
        toast.error(t('downloadCsv'));
      },
    }),
  );

  const exportCsv = useCallback(() => mutation.mutate({ market }), [mutation, market]);

  return { mutation, exportCsv, isPending: mutation.status === 'pending' } as const;
}

export function useClassificationDashboardRefresh() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries(trpc.classificationDashboard?.pathFilter?.() ?? undefined);
  }, [queryClient, trpc.classificationDashboard]);

  return { invalidate } as const;
}

const REFRESH_MIN_SPINNER_MS = 500;

export function useClassificationDashboardRefreshButton() {
  const t = useTranslations('Classification.polish.dashboard');
  const { invalidate } = useClassificationDashboardRefresh();
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const onRefresh = useCallback(async () => {
    setBusy(true);
    setAnnouncement('');
    const start = Date.now();
    try {
      await invalidate();
    } finally {
      const elapsed = Date.now() - start;
      if (elapsed < REFRESH_MIN_SPINNER_MS) {
        await new Promise(resolve => setTimeout(resolve, REFRESH_MIN_SPINNER_MS - elapsed));
      }
      setBusy(false);
      setAnnouncement(t('refreshAnnouncement'));
    }
  }, [invalidate, t]);

  return { onRefresh, busy, announcement } as const;
}
