import {
  parseAsInteger,
  parseAsString,
  parseAsArrayOf,
  useQueryStates,
} from "nuqs";

/**
 * URL state management for invoice list filters.
 * Uses nuqs to persist filter state in the URL search params,
 * enabling shareable filtered views and browser history navigation.
 */
export function useInvoiceFilters() {
  return useQueryStates({
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(25),
    search: parseAsString.withDefault(""),
    sortBy: parseAsString.withDefault("receivedAt"),
    sortOrder: parseAsString.withDefault("desc"),
    status: parseAsArrayOf(parseAsString).withDefault([]),
    matchStatus: parseAsString.withDefault(""),
    source: parseAsArrayOf(parseAsString).withDefault([]),
    contractorId: parseAsString.withDefault(""),
  });
}
