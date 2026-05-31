/** Estimated row count for cursor-based tables using page-number pagination UI. */
export function cursorPaginationTotalRows(
  pageIndex: number,
  pageSize: number,
  itemCount: number,
  hasNextPage: boolean,
): number {
  return pageIndex * pageSize + itemCount + (hasNextPage ? 1 : 0);
}
