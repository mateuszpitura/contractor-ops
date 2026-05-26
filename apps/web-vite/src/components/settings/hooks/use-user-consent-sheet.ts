import { useQuery } from '@tanstack/react-query';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter';
import { useTRPC } from '../../../providers/trpc-provider.js';

export type ConsentMapEntry = {
  purpose: string;
  granted: boolean;
  version: number;
  lastUpdated: Date | string;
};

export type ConsentHistoryRow = {
  id: string;
  purpose: string;
  granted: boolean;
  version: number;
  grantedAt: Date | string | null;
  revokedAt: Date | string | null;
  createdAt: Date | string;
};

export function useUserConsentCurrent(userId: string, enabled: boolean) {
  const trpc = useTRPC();
  const consentQuery = useQuery({
    ...trpc.consent.adminGetUserConsent.queryOptions({ userId }),
    enabled,
  });
  const entries = Object.entries(
    (consentQuery.data ?? {}) as unknown as Record<string, ConsentMapEntry>,
  );

  return {
    isLoading: consentQuery.isLoading,
    entries,
  } as const;
}

export function useUserConsentHistory(userId: string, enabled: boolean) {
  const trpc = useTRPC();
  const historyQuery = useQuery({
    ...trpc.consent.adminGetUserConsentHistory.queryOptions({ userId }),
    enabled,
  });
  const rows = (historyQuery.data ?? []) as unknown as ConsentHistoryRow[];

  return {
    isLoading: historyQuery.isLoading,
    rows,
  } as const;
}

export function useUserConsentSheet(userId: string | null, open: boolean) {
  const t = useTranslations('Settings.userConsent');
  const { formatDate } = useDateFormatter();
  const enabled = !!userId && open;
  const current = useUserConsentCurrent(userId ?? '', enabled);
  const history = useUserConsentHistory(userId ?? '', enabled);

  return {
    t,
    formatDate,
    enabled,
    current,
    history,
  } as const;
}
