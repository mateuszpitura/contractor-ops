import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';
import { parseFilterParam } from '../intake/intake-filter-chips.js';
import type { ProfileLevel } from '../intake/intake-profile-level-badge.js';
import type { IntakeStatus } from '../intake/intake-status-pill.js';
import type { ValidationStatus } from '../intake/intake-validation-status-pill.js';

export interface IntakeRow {
  id: string;
  createdAt: string | Date;
  extractedSupplierName: string | null;
  extractedInvoiceNumber: string | null;
  extractedInvoiceDate: string | Date | null;
  extractedTotalMinor: number | null | string;
  extractedCurrency: string | null;
  extractedProfileLevel: ProfileLevel | null;
  status: IntakeStatus;
  validationStatus: ValidationStatus | null;
}

export function useIntakeList(initialStatus?: string | null) {
  const trpc = useTRPC();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);

  const currentFilter = parseFilterParam(initialStatus ?? null);
  const statusFilter = currentFilter === 'all' ? undefined : currentFilter;

  const statusEnum = useMemo(() => {
    if (!statusFilter) return;
    const map: Record<string, IntakeStatus> = {
      needsReview: 'NEEDS_REVIEW',
      matched: 'MATCHED',
      converted: 'CONVERTED',
      rejected: 'REJECTED',
    };
    return map[statusFilter];
  }, [statusFilter]);

  const lastCursor = cursors[cursors.length - 1];
  const listQuery = useQuery(
    trpc.invoiceIntake.listByOrg.queryOptions({
      status: statusEnum,
      cursor: lastCursor,
      limit: 25,
    }),
  );

  const handleLoadMore = useCallback(() => {
    const data = listQuery.data as { nextCursor?: string } | undefined;
    if (data?.nextCursor) {
      setCursors(prev => [...prev, data.nextCursor]);
    }
  }, [listQuery.data]);

  const handleRetry = useCallback(() => {
    void listQuery.refetch();
  }, [listQuery]);

  const rows = (listQuery.data as { items?: IntakeRow[] } | undefined)?.items ?? [];
  const nextCursor = (listQuery.data as { nextCursor?: string } | undefined)?.nextCursor;

  return {
    rows,
    nextCursor,
    statusFilter,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    isError: listQuery.isError,
    handleRetry,
    onLoadMore: handleLoadMore,
    uploadOpen,
    setUploadOpen,
    onEmptyCta: () => setUploadOpen(true),
  } as const;
}
