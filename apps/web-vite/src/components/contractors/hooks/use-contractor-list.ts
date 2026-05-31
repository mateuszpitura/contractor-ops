import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ContractorRow } from '../contractor-table/columns.js';
import { useContractorFilters } from '../contractor-table/use-contractor-filters.js';
import type { ContractorBulkActionsHandlers } from './use-contractor-bulk-actions.js';
import { useContractorBulkActions } from './use-contractor-bulk-actions.js';

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

export function useContractorList(options: { onAddContractor: () => void; onImport?: () => void }) {
  const trpc = useTRPC();
  const te = useTranslations('EmptyStates');
  const [filters, setFilters] = useContractorFilters();

  const countQuery = useQuery(trpc.contractor.list.queryOptions({ page: 1, pageSize: 10 }));
  const totalCount = (countQuery.data as { total: number } | undefined)?.total ?? 0;
  const isCountLoading = countQuery.isLoading || countQuery.isFetching;
  const showEmptyState = !isCountLoading && totalCount === 0;

  const queryInput = useMemo(
    () => ({
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search || undefined,
      sortBy:
        (filters.sortBy as 'createdAt' | 'legalName' | 'status' | 'lifecycleStage' | 'type') ||
        'createdAt',
      sortOrder: (filters.sortOrder as 'asc' | 'desc') || 'desc',
      filters: {
        lifecycleStage: filters.lifecycleStage.length
          ? (filters.lifecycleStage as Array<
              'DRAFT' | 'ONBOARDING' | 'ACTIVE' | 'OFFBOARDING' | 'ENDED'
            >)
          : undefined,
        type: filters.type.length
          ? (filters.type as Array<'SOLE_TRADER' | 'COMPANY' | 'INDIVIDUAL_FREELANCER' | 'OTHER'>)
          : undefined,
        ownerUserId: filters.owner.length ? filters.owner : undefined,
        primaryTeamId: filters.team.length ? filters.team : undefined,
        billingModel: filters.billingModel.length ? filters.billingModel : undefined,
        complianceHealth: filters.health.length
          ? (filters.health as Array<'green' | 'yellow' | 'red'>)
          : undefined,
      },
    }),
    [filters],
  );

  const contractorsQuery = useQuery({
    ...trpc.contractor.list.queryOptions(queryInput),
    placeholderData: keepPreviousData,
  });

  const data = useMemo(() => {
    const result = contractorsQuery.data as { items: ContractorRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [contractorsQuery.data]);

  const totalRows = useMemo(() => {
    const result = contractorsQuery.data as { items: unknown[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [contractorsQuery.data]);

  const usersQuery = useQuery(trpc.user.list.queryOptions());
  const users = Array.isArray(usersQuery.data) ? (usersQuery.data as ContractorUserOption[]) : [];

  const bulkActions = useContractorBulkActions(totalRows);

  const isLoading = contractorsQuery.isPending && !contractorsQuery.data;
  const isRefetching = contractorsQuery.isFetching && !isLoading;

  const activeFilterCount =
    (filters.search.length > 0 ? 1 : 0) +
    (filters.lifecycleStage.length > 0 ? 1 : 0) +
    (filters.type.length > 0 ? 1 : 0) +
    (filters.owner.length > 0 ? 1 : 0) +
    (filters.team.length > 0 ? 1 : 0) +
    (filters.billingModel.length > 0 ? 1 : 0) +
    (filters.health.length > 0 ? 1 : 0);
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

  const clearFilters = useCallback(() => {
    void setFilters({
      search: '',
      lifecycleStage: [],
      type: [],
      owner: [],
      team: [],
      billingModel: [],
      health: [],
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
