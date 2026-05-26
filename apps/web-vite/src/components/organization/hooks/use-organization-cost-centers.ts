import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { CostCenterRow } from '../cost-centers/cost-center-form-sheet.js';
import type { CostCenterTableRow } from '../cost-centers/cost-center-table.js';

export function useOrganizationCostCenters() {
  const trpc = useTRPC();
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenterRow | null>(null);

  const listQuery = useQuery(
    trpc.organizationDefinitions.costCenter.list.queryOptions({
      search: search.trim() ? search.trim() : undefined,
      limit: 100,
    }),
  );

  const rows: CostCenterTableRow[] = (listQuery.data?.items ?? []).map(item => ({
    ...item,
    updatedAt: item.updatedAt as Date | string,
  }));

  return {
    search,
    setSearch,
    sheetOpen,
    setSheetOpen,
    csvOpen,
    setCsvOpen,
    editing,
    setEditing,
    rows,
    isLoading: listQuery.isLoading,
  } as const;
}
