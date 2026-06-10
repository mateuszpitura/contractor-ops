import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useListDataTable } from '../../../hooks/use-list-data-table.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { EquipmentRow } from '../equipment-table/equipment-columns.js';

type EquipmentType = 'LAPTOP' | 'MONITOR' | 'PHONE' | 'HEADSET' | 'KEYBOARD' | 'MOUSE' | 'OTHER';
type EquipmentStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'RETURN_REQUESTED'
  | 'RETURN_IN_TRANSIT'
  | 'RETURNED'
  | 'RETIRED';
type EquipmentSortBy = 'name' | 'serialNumber' | 'type' | 'status' | 'createdAt';

export interface EquipmentTableQueryInput {
  page: number;
  pageSize: number;
  search?: string;
  type?: EquipmentType[];
  status?: EquipmentStatus[];
  sortBy: EquipmentSortBy;
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_PAGE_SIZE = 25;
const STORAGE_KEY = 'equipment-table-columns';

export function useEquipmentTable(parentLoading?: boolean) {
  const trpc = useTRPC();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const queryInput = useMemo<EquipmentTableQueryInput>(
    () => ({
      page,
      pageSize,
      search: search || undefined,
      type: typeFilter.length ? (typeFilter as EquipmentType[]) : undefined,
      status: statusFilter.length ? (statusFilter as EquipmentStatus[]) : undefined,
      sortBy: sortBy as EquipmentSortBy,
      sortOrder,
    }),
    [page, pageSize, search, typeFilter, statusFilter, sortBy, sortOrder],
  );

  const equipmentQuery = useQuery({
    ...trpc.equipment.list.queryOptions(queryInput),
    placeholderData: keepPreviousData,
  });

  const data = useMemo(() => {
    const result = equipmentQuery.data as { items: EquipmentRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [equipmentQuery.data]);

  const totalRows = useMemo(() => {
    const result = equipmentQuery.data as { items: unknown[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [equipmentQuery.data]);

  const onSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const onFiltersChange = useCallback((partial: Partial<{ type: string[]; status: string[] }>) => {
    if (partial.type !== undefined) setTypeFilter(partial.type);
    if (partial.status !== undefined) setStatusFilter(partial.status);
    setPage(1);
  }, []);

  const onPageChange = useCallback((next: number) => setPage(next), []);
  const onPageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);
  const onSortChange = useCallback((nextSortBy: string, nextSortOrder: 'asc' | 'desc') => {
    setSortBy(nextSortBy);
    setSortOrder(nextSortOrder);
    setPage(1);
  }, []);

  const { sorting, handleSortingChange } = useListDataTable<EquipmentRow>({
    storageKey: STORAGE_KEY,
    filters: { sortBy, sortOrder },
    onSortChange,
    defaultSortBy: 'createdAt',
  });

  const onClearFilters = useCallback(() => {
    setSearch('');
    setTypeFilter([]);
    setStatusFilter([]);
    setPage(1);
  }, []);

  const isLoading = equipmentQuery.isPending && !equipmentQuery.data;
  const isRefetching = equipmentQuery.isFetching && !isLoading;
  const activeFilterCount =
    (search.length > 0 ? 1 : 0) +
    (typeFilter.length > 0 ? 1 : 0) +
    (statusFilter.length > 0 ? 1 : 0);
  const hasFiltersOrSearch = activeFilterCount > 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  return {
    equipmentQuery,
    data,
    totalRows,
    search,
    typeFilter,
    statusFilter,
    page,
    pageSize,
    sortBy,
    sortOrder,
    onSearchChange,
    onFiltersChange,
    onPageChange,
    onPageSizeChange,
    onSortChange,
    sorting,
    handleSortingChange,
    onClearFilters,
    isLoading,
    isRefetching,
    activeFilterCount,
    hasFiltersOrSearch,
    totalPages,
    parentLoading,
    rowSelection,
    setRowSelection,
  } as const;
}
