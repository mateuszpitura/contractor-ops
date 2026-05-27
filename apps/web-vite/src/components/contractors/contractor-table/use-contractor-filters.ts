import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';

/**
 * URL state management for contractor list filters.
 * Uses nuqs to persist filter state in the URL search params, enabling
 * shareable filtered views and browser history navigation.
 *
 * Note: a legacy `status` array used to live here but nothing on the new
 * contractor list reads or writes it — the analogue field is
 * `lifecycleStage` (the actual API filter). Keeping the dead field caused
 * the toolbar's "Filters" badge to count an invisible chip when a stale
 * URL carried `?status=active`. Drop it.
 */
export function useContractorFilters() {
  return useQueryStates({
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(25),
    search: parseAsString.withDefault(''),
    sortBy: parseAsString.withDefault('createdAt'),
    sortOrder: parseAsString.withDefault('desc'),
    lifecycleStage: parseAsArrayOf(parseAsString).withDefault([]),
    type: parseAsArrayOf(parseAsString).withDefault([]),
    owner: parseAsArrayOf(parseAsString).withDefault([]),
    team: parseAsArrayOf(parseAsString).withDefault([]),
    billingModel: parseAsArrayOf(parseAsString).withDefault([]),
    health: parseAsArrayOf(parseAsString).withDefault([]),
  });
}
