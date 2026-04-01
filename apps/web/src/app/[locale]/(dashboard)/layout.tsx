import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@contractor-ops/auth";
import { prisma } from "@contractor-ops/db";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { SearchProvider } from "@/components/search/search-provider";
import { BreadcrumbProvider } from "@/components/layout/breadcrumb-context";
import {
  DashboardProvider,
  type OrgInfo,
} from "@/components/layout/dashboard-context";
import { BillingOverlay } from "@/components/billing/billing-overlay";

/**
 * Dashboard layout (server component).
 *
 * Before rendering:
 * 1. Validates the session (middleware already redirects unauthenticated users,
 *    but this is a safety net).
 * 2. If the session has no activeOrganizationId, auto-activates the user's
 *    first organization so tenant-scoped tRPC queries don't 403.
 * 3. Fetches active org info + user role and passes it via DashboardProvider
 *    so client components render immediately without loading flashes.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    redirect("/login");
  }

  let activeOrgId = session.session.activeOrganizationId;

  // Auto-activate the first org if none is active
  if (!activeOrgId) {
    const membership = await prisma.member.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
      orderBy: { createdAt: "asc" },
    });

    if (membership) {
      await auth.api.setActiveOrganization({
        headers: reqHeaders,
        body: { organizationId: membership.organizationId },
      });
      activeOrgId = membership.organizationId;
    }
  }

  // Fetch active org info + user role in parallel
  let activeOrg: OrgInfo | null = null;
  let userRole: string | null = null;

  if (activeOrgId) {
    const [org, member] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: activeOrgId },
        select: { id: true, name: true, slug: true, logo: true },
      }),
      prisma.member.findFirst({
        where: { organizationId: activeOrgId, userId: session.user.id },
        select: { role: true },
      }),
    ]);

    activeOrg = org;
    userRole = member?.role ?? null;
  }

  return (
    <DashboardProvider activeOrg={activeOrg} userRole={userRole}>
      <BreadcrumbProvider>
      <SearchProvider>
        <SidebarProvider>
          {/* Skip to content link — visible on focus for keyboard users */}
          <a
            href="#main-content"
            className="fixed left-4 top-4 z-[100] -translate-y-16 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
          >
            Skip to content
          </a>
          <AppSidebar />
          <SidebarInset>
            <TopBar />
            <BillingOverlay />
            <main id="main-content" className="min-w-0 flex-1 overflow-x-hidden p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </SearchProvider>
      </BreadcrumbProvider>
    </DashboardProvider>
  );
}
