import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';

/**
 * URL state management for invoice list filters.
 */
export function useInvoiceFilters() {
  return useQueryStates({
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(25),
    search: parseAsString.withDefault(''),
    sortBy: parseAsString.withDefault('receivedAt'),
    sortOrder: parseAsString.withDefault('desc'),
    status: parseAsArrayOf(parseAsString).withDefault([]),
    matchStatus: parseAsArrayOf(parseAsString).withDefault([]),
    source: parseAsArrayOf(parseAsString).withDefault([]),
    contractorId: parseAsString.withDefault(''),
  });
}
