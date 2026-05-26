import { useQuery } from '@tanstack/react-query';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useFeatureFlagsTab() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.featureFlags');
  const flagsQuery = useQuery(trpc.featureFlags.list.queryOptions());

  return {
    t,
    flagsQuery,
    flags: flagsQuery.data ?? [],
    isLoading: flagsQuery.isLoading,
    isError: flagsQuery.isError,
  } as const;
}
