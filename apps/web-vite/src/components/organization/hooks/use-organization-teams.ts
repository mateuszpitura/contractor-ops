import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { TeamRow } from '../teams/team-form-sheet.js';
import type { TeamTableRow } from '../teams/team-table.js';

export function useOrganizationTeams() {
  const trpc = useTRPC();
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<TeamRow | null>(null);

  const listQuery = useQuery(
    trpc.organizationDefinitions.team.list.queryOptions({
      search: search.trim() ? search.trim() : undefined,
      limit: 50,
    }),
  );

  const rows: TeamTableRow[] = (listQuery.data?.items ?? []).map(item => ({
    ...item,
    updatedAt: item.updatedAt as Date | string,
  }));

  return {
    search,
    setSearch,
    sheetOpen,
    setSheetOpen,
    editing,
    setEditing,
    rows,
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    refetch: listQuery.refetch,
  } as const;
}
