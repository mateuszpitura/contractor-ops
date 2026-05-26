import { useQuery } from '@tanstack/react-query';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ComplianceStats } from '../zatca-trpc.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

export function useZatcaComplianceWidget(
  connectionStatus: string,
  environment: string,
  certificateExpiresAt?: string,
) {
  const zatcaTrpc = useZatcaTrpc();
  const t = useTranslations('Zatca.complianceWidget');
  const statsQuery = useQuery(zatcaTrpc.getComplianceStats.queryOptions());
  const stats = statsQuery.data as ComplianceStats | undefined;

  let expiryDays: number | null = null;
  let expiryColor = 'text-muted-foreground';
  if (certificateExpiresAt) {
    const diff = new Date(certificateExpiresAt).getTime() - Date.now();
    expiryDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    if (expiryDays < 7) {
      expiryColor = 'text-red-600 dark:text-red-400';
    } else if (expiryDays < 30) {
      expiryColor = 'text-amber-600 dark:text-amber-400';
    }
  }

  const total = stats?.total ?? 0;
  const successful = (stats?.cleared ?? 0) + (stats?.reported ?? 0);
  const healthPercent = total > 0 ? Math.round((successful / total) * 100) : 100;

  return {
    isLoading: statsQuery.isLoading,
    connectionStatus,
    environment,
    certificateExpiresAt,
    expiryDays,
    expiryColor,
    stats,
    healthPercent,
    t,
  } as const;
}
