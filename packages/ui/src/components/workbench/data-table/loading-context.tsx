'use client';

import { createContext, useContext } from 'react';

/**
 * Lets a consumer-rendered toolbar (passed via the `toolbar` prop) disable
 * its filter inputs while the table is loading without per-domain prop
 * drilling. The primitive sets this to `(isLoading || isRefetching)`.
 */
export const DataTableLoadingContext = createContext<boolean>(false);

/**
 * Returns the current loading flag for the surrounding `<DataTable>`. Returns
 * `false` when no context is mounted so callers outside the primitive don't
 * crash.
 */
export function useDataTableLoading(): boolean {
  return useContext(DataTableLoadingContext);
}
