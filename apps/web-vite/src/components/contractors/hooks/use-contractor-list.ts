import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { OnChangeFn, SortingState, VisibilityState } from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';

import { useListDataTable } from '../../../hooks/use-list-data-table.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ContractorRow } from '../contractor-table/columns.js';
import type { ContractorNuqsFilters } from '../contractor-table/use-contractor-filters.js';
import {
  toContractorFilterInput,
  useContractorFilters,
} from '../contractor-table/use-contractor-filters.js';
import type { ContractorBulkActionsHandlers } from './use-contractor-bulk-actions.js';
import { useContractorBulkActions } from './use-contractor-bulk-actions.js';

const STORAGE_KEY = 'contractor-table-columns';

export type ContractorUserOption = {
  id?: string;
  userId?: string;
  name?: string | null;
  email?: string | null;
};

export interface ContractorFilterState {
  lifecycleStage: string[];
  type: string[];
  owner: string[];
  team: string[];
  billingModel: string[];
  health: string[];
}

export interface ContractorListTableProps {
  data: ContractorRow[];
  totalRows: number;
  users: ContractorUserOption[];
  filters: ContractorFilterState & {
    search: string;
    page: number;
    pageSize: number;
    sortBy: string;
    sortOrder: string;
  };
  onFiltersChange: (
    partial: Partial<{
      lifecycleStage: string[];
      type: string[];
      owner: string[];
      team: string[];
      billingModel: string[];
      health: string[];
    }>,
  ) => void;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  clearFilters: () => void;
  isLoading: boolean;
  isRefetching: boolean;
  activeFilterCount: number;
  hasFiltersOrSearch: boolean;
  bulkActions: ContractorBulkActionsHandlers;
  columnVisibility: VisibilityState;
  setColumnVisibility: OnChangeFn<VisibilityState>;
  sorting: SortingState;
  onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
  selectedRows: ContractorRow[];
  setSelectedRows: (rows: ContractorRow[]) => void;
}

export interface ContractorListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: ContractorFilterState;
  onFiltersChange: (filters: Partial<ContractorFilterState>) => void;
  users: ContractorUserOption[];
  isSearching: boolean;
  disabled: boolean;
  onAddContractor: () => void;
  onImport?: () => void;
}

function countActiveFilters(filters: ContractorNuqsFilters): number {
  return (
    (filters.search.length > 0 ? 1 : 0) +
    (filters.lifecycleStage.length > 0 ? 1 : 0) +
    (filters.type.length > 0 ? 1 : 0) +
    (filters.owner.length > 0 ? 1 : 0) +
    (filters.team.length > 0 ? 1 : 0) +
    (filters.billingModel.length > 0 ? 1 : 0) +
    (filters.health.length > 0 ? 1 : 0) +
    (filters.country.length > 0 ? 1 : 0) +
    (filters.expiringWithin == null ? 0 : 1) +
    (filters.paymentBlocked ? 1 : 0) +
    (filters.stalled ? 1 : 0)
  );
}

function toContractorListQueryInput(filters: ContractorNuqsFilters) {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    search: filters.search || undefined,
    sortBy:
      (filters.sortBy as 'createdAt' | 'legalName' | 'status' | 'lifecycleStage' | 'type') ||
      'createdAt',
    sortOrder: (filters.sortOrder as 'asc' | 'desc') || 'desc',
    filters: toContractorFilterInput(filters),
  };
}

export function useContractorList(options: { onAddContractor: () => void; onImport?: () => void }) {
  const trpc = useTRPC();
  const te = useTranslations('EmptyStates');
  const [filters, setFilters] = useContractorFilters();

  const countQuery = useQuery(trpc.contractor.list.queryOptions({ page: 1, pageSize: 10 }));
  const totalCount = countQuery.data?.total ?? 0;
  const isCountLoading = countQuery.isLoading || countQuery.isFetching;
  const showEmptyState = !isCountLoading && totalCount === 0;

  const queryInput = useMemo(() => toContractorListQueryInput(filters), [filters]);

  const contractorsQuery = useQuery({
    ...trpc.contractor.list.queryOptions(queryInput),
    placeholderData: keepPreviousData,
  });

  const data = useMemo(
    () => (contractorsQuery.data?.items ?? []) as ContractorRow[],
    [contractorsQuery.data],
  );

  const totalRows = contractorsQuery.data?.total ?? 0;

  const usersQuery = useQuery(trpc.user.list.queryOptions());
  const users = Array.isArray(usersQuery.data) ? (usersQuery.data as ContractorUserOption[]) : [];

  const bulkActions = useContractorBulkActions(totalRows);

  const isLoading = contractorsQuery.isPending && !contractorsQuery.data;
  const isRefetching = contractorsQuery.isFetching && !isLoading;

  const activeFilterCount = countActiveFilters(filters);
  const hasFiltersOrSearch = activeFilterCount > 0;

  const handleFiltersChange = useCallback(
    (partial: Partial<ContractorFilterState>) => {
      void setFilters({ ...partial, page: 1 });
    },
    [setFilters],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      void setFilters({ search: value, page: 1 });
    },
    [setFilters],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      void setFilters({ page });
    },
    [setFilters],
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      void setFilters({ pageSize, page: 1 });
    },
    [setFilters],
  );

  const handleSortChange = useCallback(
    (sortBy: string, sortOrder: 'asc' | 'desc') => {
      void setFilters({ sortBy, sortOrder, page: 1 });
    },
    [setFilters],
  );

  const {
    columnVisibility,
    setColumnVisibility,
    selectedRows,
    setSelectedRows,
    sorting,
    handleSortingChange,
  } = useListDataTable<ContractorRow>({
    storageKey: STORAGE_KEY,
    filters: {
      sortBy: filters.sortBy,
      sortOrder: (filters.sortOrder as 'asc' | 'desc') || 'desc',
    },
    onSortChange: handleSortChange,
    defaultSortBy: 'createdAt',
  });

  const clearFilters = useCallback(() => {
    void setFilters({
      search: '',
      lifecycleStage: [],
      type: [],
      owner: [],
      team: [],
      billingModel: [],
      health: [],
      country: [],
      expiringWithin: null,
      paymentBlocked: false,
      stalled: false,
      page: 1,
    });
  }, [setFilters]);

  const filterState: ContractorListTableProps['filters'] = {
    search: filters.search,
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    lifecycleStage: filters.lifecycleStage,
    type: filters.type,
    owner: filters.owner,
    team: filters.team,
    billingModel: filters.billingModel,
    health: filters.health,
  };

  const toolbarProps: ContractorListToolbarProps = {
    search: filters.search,
    onSearchChange: handleSearchChange,
    filters: {
      lifecycleStage: filters.lifecycleStage,
      type: filters.type,
      owner: filters.owner,
      team: filters.team,
      billingModel: filters.billingModel,
      health: filters.health,
    },
    onFiltersChange: handleFiltersChange,
    users,
    isSearching: isRefetching,
    disabled: isLoading || isCountLoading,
    onAddContractor: options.onAddContractor,
    onImport: options.onImport,
  };

  const tableProps: ContractorListTableProps = {
    data,
    totalRows,
    users,
    filters: filterState,
    onFiltersChange: handleFiltersChange,
    onSearchChange: handleSearchChange,
    onPageChange: handlePageChange,
    onPageSizeChange: handlePageSizeChange,
    onSortChange: handleSortChange,
    clearFilters,
    isLoading,
    isRefetching,
    activeFilterCount,
    hasFiltersOrSearch,
    bulkActions,
    columnVisibility,
    setColumnVisibility,
    sorting,
    onSortingChange: handleSortingChange,
    selectedRows,
    setSelectedRows,
  };

  return {
    showEmptyState,
    isCountLoading,
    emptyProps: {
      onAddContractor: options.onAddContractor,
      onImport: options.onImport,
      heading: te('contractors.heading'),
      body: te('contractors.body'),
      cta: te('contractors.cta'),
      secondary: te('contractors.secondary'),
    },
    toolbarProps,
    tableProps,
  } as const;
}
