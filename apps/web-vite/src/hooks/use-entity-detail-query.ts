import type { QueryKey, QueryObserverResult, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { deriveIsNotFound } from '../lib/derive-is-not-found.js';

export type EntityDetailQueryResult<TData> = {
  query: QueryObserverResult<TData, unknown>;
  data: TData | undefined;
  isLoading: boolean;
  isError: boolean;
  isNotFound: boolean;
  hasData: boolean;
  handleRetry: () => void;
};

/**
 * Standard detail-page query wrapper with NOT_FOUND detection and retry.
 */
export function useEntityDetailQuery<
  TData,
  TError = unknown,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryOptions: UseQueryOptions<TData, TError, TData, TQueryKey>,
): EntityDetailQueryResult<TData> {
  const query = useQuery(queryOptions);

  const handleRetry = useCallback(() => {
    void query.refetch();
  }, [query]);

  const isNotFound = deriveIsNotFound(query.error);

  return {
    query,
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    isNotFound,
    hasData: Boolean(query.data),
    handleRetry,
  };
}
