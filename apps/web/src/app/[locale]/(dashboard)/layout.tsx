import type { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { SearchProvider } from "@/components/search/search-provider";

/**
 * Dashboard layout with collapsible sidebar and top bar.
 * SidebarProvider manages sidebar state (expanded/collapsed).
 * SidebarInset wraps the main content area to the right of the sidebar.
 * SearchProvider enables global Cmd+K command palette.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SearchProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <TopBar />
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </SearchProvider>
  );
}
