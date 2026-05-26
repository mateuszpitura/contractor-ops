import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';

/**
 * URL state management for contractor list filters.
 * Uses nuqs to persist filter state in the URL search params,
 * enabling shareable filtered views and browser history navigation.
 */
export function useContractorFilters() {
  return useQueryStates({
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(25),
    search: parseAsString.withDefault(''),
    sortBy: parseAsString.withDefault('createdAt'),
    sortOrder: parseAsString.withDefault('desc'),
    status: parseAsArrayOf(parseAsString).withDefault([]),
    lifecycleStage: parseAsArrayOf(parseAsString).withDefault([]),
    type: parseAsArrayOf(parseAsString).withDefault([]),
    owner: parseAsArrayOf(parseAsString).withDefault([]),
    team: parseAsArrayOf(parseAsString).withDefault([]),
    billingModel: parseAsArrayOf(parseAsString).withDefault([]),
    health: parseAsArrayOf(parseAsString).withDefault([]),
  });
}
