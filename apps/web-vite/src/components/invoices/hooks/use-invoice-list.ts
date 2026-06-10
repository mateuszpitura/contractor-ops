import type { SortingState } from '@tanstack/react-table';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useListDataTable } from '../../../hooks/use-list-data-table.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { InvoiceRow } from '../invoice-table/columns.js';
import { deriveComplianceStatus } from '../invoice-table/columns.js';
import { parseFilterParam } from '../invoice-table/compliance-filter-param.js';
import { useInvoiceFilters } from '../invoice-table/use-invoice-filters.js';
import type { InvoiceBulkActionsHandlers } from './use-invoice-bulk-actions.js';
import { useInvoiceBulkActions } from './use-invoice-bulk-actions.js';

const STORAGE_KEY = 'invoice-table-columns';

export interface InvoiceListFilterState {
  status: string[];
  matchStatus: string[];
  source: string[];
}

export interface InvoiceListTableProps {
  data: InvoiceRow[];
  totalRows: number;
  filters: InvoiceListFilterState & {
    search: string;
    page: number;
    pageSize: number;
    sortBy: string;
    sortOrder: string;
    contractorId: string;
  };
  onFiltersChange: (partial: Partial<InvoiceListFilterState & { contractorId: string }>) => void;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  clearFilters: () => void;
  isLoading: boolean;
  isRefetching: boolean;
  activeFilterCount: number;
  hasFiltersOrSearch: boolean;
  bulkActions: InvoiceBulkActionsHandlers;
  sorting: SortingState;
  onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
  selectedRows: InvoiceRow[];
  setSelectedRows: (rows: InvoiceRow[]) => void;
}

export interface InvoiceListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: InvoiceListFilterState;
  onFiltersChange: (filters: Partial<InvoiceListFilterState>) => void;
  isSearching: boolean;
  disabled: boolean;
  onUpload: () => void;
}

export function useInvoiceList(options: { onUpload: () => void }) {
  const trpc = useTRPC();
  const te = useTranslations('EmptyStates');
  const [filters, setFilters] = useInvoiceFilters();
  const [searchParams] = useSearchParams();

  const invoiceCountQuery = useQuery(trpc.invoice.list.queryOptions({ page: 1, pageSize: 10 }));
  const contractorCountQuery = useQuery(
    trpc.contractor.list.queryOptions({ page: 1, pageSize: 10 }),
  );
  const invoiceTotal = (invoiceCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const contractorCount = (contractorCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const isCountLoading = invoiceCountQuery.isLoading || invoiceCountQuery.isFetching;
  const showEmptyState = !isCountLoading && invoiceTotal === 0;

  const queryInput = useMemo(
    () => ({
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search || undefined,
      sortBy:
        (filters.sortBy as
          | 'receivedAt'
          | 'invoiceNumber'
          | 'issueDate'
          | 'dueDate'
          | 'totalMinor'
          | 'status') || 'receivedAt',
      sortOrder: (filters.sortOrder as 'asc' | 'desc') || 'desc',
      filters: {
        status: filters.status.length
          ? (filters.status as Array<
              | 'RECEIVED'
              | 'UNDER_REVIEW'
              | 'APPROVAL_PENDING'
              | 'APPROVED'
              | 'REJECTED'
              | 'READY_FOR_PAYMENT'
              | 'PARTIALLY_PAID'
              | 'PAID'
              | 'VOID'
            >)
          : undefined,
        matchStatus:
          filters.matchStatus.length > 0
            ? (filters.matchStatus as Array<
                'UNMATCHED' | 'PARTIAL' | 'MATCHED' | 'DISCREPANCY' | 'MANUALLY_CONFIRMED'
              >)
            : undefined,
        source: filters.source.length
          ? (filters.source as Array<'MANUAL_UPLOAD' | 'EMAIL_INTAKE' | 'KSEF' | 'API'>)
          : undefined,
        contractorId: filters.contractorId || undefined,
      },
    }),
    [filters],
  );

  const invoicesQuery = useQuery({
    ...trpc.invoice.list.queryOptions(queryInput),
    placeholderData: keepPreviousData,
  });

  const complianceFilters = useMemo(
    () => parseFilterParam(searchParams.get('einvoiceStatus')),
    [searchParams],
  );
  const isComplianceFilterActive =
    complianceFilters.length > 0 && !complianceFilters.includes('all');

  const data = useMemo(() => {
    const result = invoicesQuery.data as { items: InvoiceRow[]; total: number } | undefined;
    const rows = result?.items ?? [];
    if (!isComplianceFilterActive) return rows;
    const allowed = new Set(complianceFilters);
    return rows.filter(row => allowed.has(deriveComplianceStatus(row.eInvoiceLifecycle)));
  }, [invoicesQuery.data, complianceFilters, isComplianceFilterActive]);

  const totalRows = useMemo(() => {
    const result = invoicesQuery.data as { items: unknown[]; total: number } | undefined;
    if (isComplianceFilterActive) return data.length;
    return result?.total ?? 0;
  }, [invoicesQuery.data, isComplianceFilterActive, data.length]);

  const isLoading = invoicesQuery.isPending && !invoicesQuery.data;
  const isRefetching = invoicesQuery.isFetching && !isLoading;

  const bulkActions = useInvoiceBulkActions();

  const activeFilterCount =
    (filters.search.length > 0 ? 1 : 0) +
    (filters.status.length > 0 ? 1 : 0) +
    (filters.matchStatus.length > 0 ? 1 : 0) +
    (filters.source.length > 0 ? 1 : 0) +
    (filters.contractorId.length > 0 ? 1 : 0);
  const hasFiltersOrSearch = activeFilterCount > 0;

  const handleFiltersChange = useCallback(
    (partial: Partial<InvoiceListFilterState & { contractorId: string }>) => {
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
    selectedRows,
    setSelectedRows,
    sorting,
    handleSortingChange,
  } = useListDataTable<InvoiceRow>({
    storageKey: STORAGE_KEY,
    filters: {
      sortBy: filters.sortBy,
      sortOrder: (filters.sortOrder as 'asc' | 'desc') || 'desc',
    },
    onSortChange: handleSortChange,
    defaultSortBy: 'receivedAt',
  });

  const clearFilters = useCallback(() => {
    void setFilters({
      search: '',
      status: [],
      matchStatus: [],
      source: [],
      contractorId: '',
      page: 1,
    });
  }, [setFilters]);

  const filterState: InvoiceListTableProps['filters'] = {
    search: filters.search,
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    status: filters.status,
    matchStatus: filters.matchStatus,
    source: filters.source,
    contractorId: filters.contractorId,
  };

  const toolbarProps: InvoiceListToolbarProps = {
    search: filters.search,
    onSearchChange: handleSearchChange,
    filters: {
      status: filters.status,
      matchStatus: filters.matchStatus,
      source: filters.source,
    },
    onFiltersChange: handleFiltersChange,
    isSearching: isRefetching,
    disabled: isLoading || isCountLoading,
    onUpload: options.onUpload,
  };

  const tableProps: InvoiceListTableProps = {
    data,
    totalRows,
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
      onUpload: options.onUpload,
      heading: te('invoices.heading'),
      body: te('invoices.body'),
      cta: te('invoices.cta'),
      secondary: te('invoices.secondary'),
      prerequisiteCta: te('prerequisite.cta'),
    },
    toolbarProps,
    tableProps,
  } as const;
}
