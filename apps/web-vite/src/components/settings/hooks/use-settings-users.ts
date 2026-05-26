import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useSettingsUsers() {
  const trpc = useTRPC();
  const usersQuery = useQuery(trpc.user.list.queryOptions());

  return {
    usersQuery,
    users: usersQuery.data ?? [],
    isLoading: usersQuery.isLoading,
  } as const;
}
