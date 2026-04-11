"use client";

import { createContext, useContext, type ReactNode } from "react";

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
