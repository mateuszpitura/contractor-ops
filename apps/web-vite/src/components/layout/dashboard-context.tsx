/**
 * Dashboard layout context — active org + role. Lifted from
 * apps/web/src/components/layout/dashboard-context.tsx unchanged.
 *
 * In the SPA the provider is populated from a tRPC query at the
 * dashboard shell mount; the context shape stays identical so the legacy
 * `useDashboardContext()` call sites work after the import-path swap.
 */

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

export type OrgInfo = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
};

type DashboardContextValue = {
  activeOrg: OrgInfo | null;
  userRole: string | null;
};

const DashboardContext = createContext<DashboardContextValue>({
  activeOrg: null,
  userRole: null,
});

export function DashboardProvider({
  activeOrg,
  userRole,
  children,
}: DashboardContextValue & { children: ReactNode }) {
  return (
    <DashboardContext.Provider value={{ activeOrg, userRole }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  return useContext(DashboardContext);
}
