/** True when the list should show the full-page empty state (no search/filters active). */
export function isFeaturedEmptyList({
  isLoading = false,
  isError = false,
  itemCount,
  hasSearch,
}: {
  isLoading?: boolean;
  isError?: boolean;
  itemCount: number;
  hasSearch: boolean;
}): boolean {
  return !(isLoading || isError) && itemCount === 0 && !hasSearch;
}
