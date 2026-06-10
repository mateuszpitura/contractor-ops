import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ProjectTableRow } from '../projects/data-table.js';
import type { ProjectRow } from '../projects/project-form-sheet.js';

export function useOrganizationProjects() {
  const trpc = useTRPC();
  const toasts = useCommonToasts();
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

  const syncMutation = useResourceMutation(
    trpc.organizationDefinitions.project.sync.mutationOptions(),
    {
      successMessage: toasts.done(),
      invalidate: [trpc.organizationDefinitions.project.pathFilter()],
    },
  );

  const isLoading = listQuery.isLoading;
  const isFetching = listQuery.isFetching;

  return {
    search,
    setSearch,
    sheetOpen,
    setSheetOpen,
    editing,
    setEditing,
    rows,
    teamNamesById,
    isLoading,
    isFetching,
    connections: connectionsQuery.data ?? [],
    syncMutation,
  } as const;
}
