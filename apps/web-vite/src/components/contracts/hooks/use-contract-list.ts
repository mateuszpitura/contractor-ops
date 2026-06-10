import type {
  BillingModel,
  ComplianceRiskLevel,
  ContractStatus,
  ContractType,
} from '@contractor-ops/validators';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { OnChangeFn, SortingState, VisibilityState } from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';

import { useListDataTable } from '../../../hooks/use-list-data-table.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ContractRow } from '../contract-table/columns.js';
import { useContractFilters } from '../contract-table/use-contract-filters.js';
import type { ContractBulkActionsHandlers } from './use-contract-bulk-actions.js';
import { useContractBulkActions } from './use-contract-bulk-actions.js';

const STORAGE_KEY = 'contract-table-columns';

export type ContractUserOption = {
  id?: string;
  userId?: string;
  name?: string | null;
  email?: string | null;
};

export interface ContractListFilterState {
  status: string[];
  type: string[];
  billingModel: string[];
  ownerUserId: string[];
  startDateFrom: string;
  startDateTo: string;
  endDateFrom: string;
  endDateTo: string;
  complianceRiskLevel: string[];
}

export interface ContractListTableProps {
  data: ContractRow[];
  totalRows: number;
  users: ContractUserOption[];
  filters: ContractListFilterState & {
    search: string;
    page: number;
    pageSize: number;
    sortBy: string;
    sortOrder: string;
  };
  onFiltersChange: (partial: Partial<ContractListFilterState>) => void;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  clearFilters: () => void;
  isLoading: boolean;
  isRefetching: boolean;
  activeFilterCount: number;
  hasFiltersOrSearch: boolean;
  bulkActions: ContractBulkActionsHandlers;
  columnVisibility: VisibilityState;
  setColumnVisibility: OnChangeFn<VisibilityState>;
  sorting: SortingState;
  onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
  selectedRows: ContractRow[];
  setSelectedRows: (rows: ContractRow[]) => void;
}

export interface ContractListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: ContractListFilterState;
  onFiltersChange: (filters: Partial<ContractListFilterState>) => void;
  users: ContractUserOption[];
  isSearching: boolean;
  disabled: boolean;
  onNewContract: () => void;
  onImport?: () => void;
}

function asFilterArray<T extends string>(arr: string[]): T[] | undefined {
  return arr.length ? (arr as T[]) : undefined;
}

function asFilterString(val: string): string | undefined {
  return val || undefined;
}

function asDateFilter(val: string): string | undefined {
  return val ? new Date(val).toISOString() : undefined;
}

export function useContractList(options: { onNewContract: () => void; onImport?: () => void }) {
  const trpc = useTRPC();
  const te = useTranslations('EmptyStates');
  const [filters, setFilters] = useContractFilters();

  const contractCountQuery = useQuery(trpc.contract.list.queryOptions({ page: 1, pageSize: 10 }));
  const contractorCountQuery = useQuery(
    trpc.contractor.list.queryOptions({ page: 1, pageSize: 10 }),
  );
  const contractTotal = (contractCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const contractorCount = (contractorCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const isCountLoading = contractCountQuery.isLoading || contractCountQuery.isFetching;
  const showEmptyState = !isCountLoading && contractTotal === 0;

  const queryInput = useMemo(
    () => ({
      page: filters.page,
      pageSize: filters.pageSize,
      search: asFilterString(filters.search),
      sortBy:
        (filters.sortBy as 'createdAt' | 'title' | 'status' | 'endDate' | 'startDate' | 'type') ||
        'endDate',
      sortOrder: (filters.sortOrder as 'asc' | 'desc') || 'asc',
      filters: {
        status: asFilterArray<ContractStatus>(filters.status),
        type: asFilterArray<ContractType>(filters.type),
        billingModel: asFilterArray<BillingModel>(filters.billingModel),
        ownerUserId: asFilterArray(filters.ownerUserId),
        startDateFrom: asDateFilter(filters.startDateFrom),
        startDateTo: asDateFilter(filters.startDateTo),
        endDateFrom: asDateFilter(filters.endDateFrom),
        endDateTo: asDateFilter(filters.endDateTo),
        complianceRiskLevel: asFilterArray<ComplianceRiskLevel>(filters.complianceRiskLevel),
      },
    }),
    [filters],
  );

  const contractsQuery = useQuery({
    ...trpc.contract.list.queryOptions(queryInput),
    placeholderData: keepPreviousData,
  });

  const data = useMemo(() => {
    const result = contractsQuery.data as { items: ContractRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [contractsQuery.data]);

  const totalRows = useMemo(() => {
    const result = contractsQuery.data as { items: unknown[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [contractsQuery.data]);

  const usersQuery = useQuery(trpc.user.list.queryOptions());
  const users = Array.isArray(usersQuery.data) ? (usersQuery.data as ContractUserOption[]) : [];

  const bulkActions = useContractBulkActions(totalRows);

  const isLoading = contractsQuery.isPending && !contractsQuery.data;
  const isRefetching = contractsQuery.isFetching && !isLoading;

  const activeFilterCount =
    (filters.search.length > 0 ? 1 : 0) +
    (filters.status.length > 0 ? 1 : 0) +
    (filters.type.length > 0 ? 1 : 0) +
    (filters.billingModel.length > 0 ? 1 : 0) +
    (filters.ownerUserId.length > 0 ? 1 : 0) +
    (filters.complianceRiskLevel.length > 0 ? 1 : 0) +
    (filters.startDateFrom.length > 0 || filters.startDateTo.length > 0 ? 1 : 0) +
    (filters.endDateFrom.length > 0 || filters.endDateTo.length > 0 ? 1 : 0);
  const hasFiltersOrSearch = activeFilterCount > 0;

  const handleFiltersChange = useCallback(
    (partial: Partial<ContractListFilterState>) => {
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
  } = useListDataTable<ContractRow>({
    storageKey: STORAGE_KEY,
    filters: {
      sortBy: filters.sortBy,
      sortOrder: (filters.sortOrder as 'asc' | 'desc') || 'asc',
    },
    onSortChange: handleSortChange,
    defaultSortBy: 'endDate',
    defaultSortOrder: 'asc',
  });

  const clearFilters = useCallback(() => {
    void setFilters({
      search: '',
      status: [],
      type: [],
      billingModel: [],
      ownerUserId: [],
      startDateFrom: '',
      startDateTo: '',
      endDateFrom: '',
      endDateTo: '',
      complianceRiskLevel: [],
      page: 1,
    });
  }, [setFilters]);

  const filterState: ContractListTableProps['filters'] = {
    search: filters.search,
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    status: filters.status,
    type: filters.type,
    billingModel: filters.billingModel,
    ownerUserId: filters.ownerUserId,
    startDateFrom: filters.startDateFrom,
    startDateTo: filters.startDateTo,
    endDateFrom: filters.endDateFrom,
    endDateTo: filters.endDateTo,
    complianceRiskLevel: filters.complianceRiskLevel,
  };

  const toolbarProps: ContractListToolbarProps = {
    search: filters.search,
    onSearchChange: handleSearchChange,
    filters: {
      status: filters.status,
      type: filters.type,
      billingModel: filters.billingModel,
      ownerUserId: filters.ownerUserId,
      startDateFrom: filters.startDateFrom,
      startDateTo: filters.startDateTo,
      endDateFrom: filters.endDateFrom,
      endDateTo: filters.endDateTo,
      complianceRiskLevel: filters.complianceRiskLevel,
    },
    onFiltersChange: handleFiltersChange,
    users,
    isSearching: isRefetching,
    disabled: isLoading || isCountLoading,
    onNewContract: options.onNewContract,
    onImport: options.onImport,
  };

  const tableProps: ContractListTableProps = {
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
    contractorCount,
    emptyProps: {
      onNewContract: options.onNewContract,
      heading: te('contracts.heading'),
      body: te('contracts.body'),
      cta: te('contracts.cta'),
      prerequisiteCta: te('prerequisite.cta'),
    },
    toolbarProps,
    tableProps,
  } as const;
}
