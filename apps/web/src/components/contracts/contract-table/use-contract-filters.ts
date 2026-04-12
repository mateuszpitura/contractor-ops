import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";

/**
 * URL state management for contract list filters.
 * Uses nuqs to persist filter state in the URL search params,
 * enabling shareable filtered views and browser history navigation.
 */
export function useContractFilters() {
  return useQueryStates({
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(25),
    search: parseAsString.withDefault(""),
    sortBy: parseAsString.withDefault("endDate"),
    sortOrder: parseAsString.withDefault("asc"),
    status: parseAsArrayOf(parseAsString).withDefault([]),
    type: parseAsArrayOf(parseAsString).withDefault([]),
    billingModel: parseAsArrayOf(parseAsString).withDefault([]),
    ownerUserId: parseAsArrayOf(parseAsString).withDefault([]),
    endDateFrom: parseAsString.withDefault(""),
    endDateTo: parseAsString.withDefault(""),
    complianceRiskLevel: parseAsArrayOf(parseAsString).withDefault([]),
  });
}
