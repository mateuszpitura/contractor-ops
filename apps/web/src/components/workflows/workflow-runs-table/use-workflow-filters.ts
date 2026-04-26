import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from 'nuqs';

/**
 * URL state management for workflow runs list filters.
 * Uses nuqs to persist filter state in the URL search params,
 * enabling shareable filtered views and browser history navigation.
 */
export function useWorkflowFilters() {
  return useQueryStates({
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(25),
    search: parseAsString.withDefault(''),
    sortBy: parseAsString.withDefault('dueAt'),
    sortOrder: parseAsString.withDefault('asc'),
    status: parseAsArrayOf(parseAsString).withDefault([]),
    templateId: parseAsArrayOf(parseAsString).withDefault([]),
    overdueOnly: parseAsBoolean.withDefault(false),
  });
}
