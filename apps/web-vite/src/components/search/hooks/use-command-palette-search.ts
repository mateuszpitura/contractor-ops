import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';

export type SearchResultItem = {
  id: string;
  name: string;
  subtitle: string;
  type: 'contractor' | 'contract' | 'invoice';
};

export type DocSearchResultItem = {
  id: string;
  title: string;
  icon?: string | null;
  subtitle: string;
  url: string;
  provider: 'notion' | 'confluence';
};

export function useCommandPaletteSearch(debouncedQuery: string, open: boolean) {
  const trpc = useTRPC();
  const isSearching = debouncedQuery.length >= 2;

  const searchQuery = useQuery({
    ...trpc.search.global.queryOptions({ query: debouncedQuery }),
    enabled: isSearching,
  });

  const searchResults = useMemo(() => {
    if (!searchQuery.data) return [];
    return searchQuery.data as SearchResultItem[];
  }, [searchQuery.data]);

  const docSearchQuery = useQuery({
    ...trpc.docs.search.queryOptions({ query: debouncedQuery, provider: 'all' }),
    enabled: open && isSearching,
  });

  const docResults = useMemo(() => {
    if (!docSearchQuery.data) return [];
    return (docSearchQuery.data as DocSearchResultItem[]).slice(0, 5);
  }, [docSearchQuery.data]);

  const isLoading = searchQuery.isLoading && isSearching;
  const isDocLoading = docSearchQuery.isLoading;

  return {
    searchQuery,
    searchResults,
    docSearchQuery,
    docResults,
    isSearching,
    isLoading,
    isDocLoading,
  } as const;
}
