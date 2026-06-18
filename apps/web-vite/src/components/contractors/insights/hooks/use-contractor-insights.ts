import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useTRPC } from '../../../../providers/trpc-provider.js';
import type { ContractorNuqsFilters } from '../../contractor-table/use-contractor-filters.js';
import {
  toContractorFilterInput,
  useContractorFilters,
} from '../../contractor-table/use-contractor-filters.js';
import type { CompositionGroup } from '../composition-strip.js';

/** Window applied when the "expiring soon" attention item is toggled on. */
const EXPIRING_WINDOW_DAYS = 30;

/**
 * Sole tRPC boundary for the contractor insight band. Reads the shared nuqs
 * filter state to (a) feed `contractor.insights` the same filter contract the
 * table uses and (b) derive each control's active state, and exposes toggle
 * handlers that write back to that same state (resetting to page 1).
 */
export function useContractorInsights() {
  const trpc = useTRPC();
  const [filters, setFilters] = useContractorFilters();

  const queryInput = useMemo(
    () => ({ search: filters.search || undefined, filters: toContractorFilterInput(filters) }),
    [filters],
  );

  const query = useQuery(trpc.contractor.insights.queryOptions(queryInput));

  const applyFilters = useCallback(
    (partial: Partial<ContractorNuqsFilters>) => {
      void setFilters({ ...partial, page: 1 });
    },
    [setFilters],
  );

  const atRiskActive = filters.health.length === 1 && filters.health[0] === 'red';
  const expiringActive = filters.expiringWithin != null;
  const paymentBlockedActive = filters.paymentBlocked;
  const stalledActive = filters.stalled;

  const onToggleAtRisk = useCallback(
    () => applyFilters({ health: atRiskActive ? [] : ['red'] }),
    [applyFilters, atRiskActive],
  );
  const onToggleExpiring = useCallback(
    () => applyFilters({ expiringWithin: expiringActive ? null : EXPIRING_WINDOW_DAYS }),
    [applyFilters, expiringActive],
  );
  const onTogglePaymentBlocked = useCallback(
    () => applyFilters({ paymentBlocked: !paymentBlockedActive }),
    [applyFilters, paymentBlockedActive],
  );
  const onToggleStalled = useCallback(
    () => applyFilters({ stalled: !stalledActive }),
    [applyFilters, stalledActive],
  );

  const toggleSegment = useCallback(
    (group: CompositionGroup, value: string) => {
      const current = filters[group];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      applyFilters({ [group]: next } as Partial<ContractorNuqsFilters>);
    },
    [filters, applyFilters],
  );

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    onRetry: () => void query.refetch(),
    activeSegments: {
      lifecycleStage: filters.lifecycleStage,
      type: filters.type,
      country: filters.country,
      health: filters.health,
    },
    attention: {
      atRiskActive,
      expiringActive,
      paymentBlockedActive,
      stalledActive,
      onToggleAtRisk,
      onToggleExpiring,
      onTogglePaymentBlocked,
      onToggleStalled,
    },
    toggleSegment,
  };
}
