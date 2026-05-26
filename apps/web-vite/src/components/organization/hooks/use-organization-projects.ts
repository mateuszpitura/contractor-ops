import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ProjectRow } from '../projects/project-form-sheet.js';
import type { ProjectTableRow } from '../projects/project-table.js';

export function useOrganizationProjects() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRow | null>(null);

  const listQuery = useQuery(
    trpc.organizationDefinitions.project.list.queryOptions({
      search: search.trim() ? search.trim() : undefined,
      limit: 50,
    }),
  );

  const teamsQuery = useQuery(
    trpc.organizationDefinitions.team.list.queryOptions({ status: 'ACTIVE', limit: 200 }),
  );

  const teamNamesById = Object.fromEntries(
    (teamsQuery.data?.items ?? []).map(team => [team.id, team.name]),
  );

  const rows: ProjectTableRow[] = (listQuery.data?.items ?? []).map(item => ({
    ...item,
    updatedAt: item.updatedAt as Date | string,
  }));

  const connectionsQuery = useQuery(
    trpc.organizationDefinitions.project.listSyncableConnections.queryOptions(),
  );

  const syncMutation = useMutation(
    trpc.organizationDefinitions.project.sync.mutationOptions({
      onSuccess: result => {
        toast.success(
          `Sync complete — inserted ${result.inserted}, linked ${result.linked}, pending ${result.pending}`,
        );
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.project.list.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.organizationDefinitions.project.pendingMerges.queryKey(),
        });
      },
      onError: err => toast.error(err.message),
    }),
  );

  return {
    search,
    setSearch,
    sheetOpen,
    setSheetOpen,
    editing,
    setEditing,
    rows,
    teamNamesById,
    isLoading: listQuery.isLoading,
    connections: connectionsQuery.data ?? [],
    syncMutation,
  } as const;
}
