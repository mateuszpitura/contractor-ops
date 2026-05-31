/** Disable list toolbars (search, filters, header actions) until the list query settles. */
export function isListControlsDisabled({
  isLoading = false,
  isFetching = false,
  parentLoading = false,
}: {
  isLoading?: boolean;
  isFetching?: boolean;
  parentLoading?: boolean;
}): boolean {
  return isLoading || isFetching || parentLoading;
}
