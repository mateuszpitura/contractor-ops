import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useClassificationExpertHelp() {
  const trpc = useTRPC();
  const orgConfig = useQuery(trpc.contractor.getCountryFieldsConfig.queryOptions());

  const isDE = orgConfig.data?.countryCode === 'DE';
  const jurisdiction = orgConfig.data?.countryCode ?? 'GB';

  return {
    orgConfig,
    isPending: orgConfig.isPending,
    isDE,
    jurisdiction,
  } as const;
}
