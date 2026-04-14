import { auth } from '@contractor-ops/auth';
import { prisma } from '@contractor-ops/db';
import type { FlagValues } from '@contractor-ops/feature-flags';
import { buildFlagBag, emptyFlagBag } from '@contractor-ops/feature-flags';
import { createLogger } from '@contractor-ops/logger';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { BillingOverlay } from '@/components/billing/billing-overlay';
import { AppFooter } from '@/components/layout/app-footer';
import { BreadcrumbProvider } from '@/components/layout/breadcrumb-context';
import type { OrgInfo } from '@/components/layout/dashboard-context';
import { DashboardProvider } from '@/components/layout/dashboard-context';
import { FeatureFlagProvider } from '@/components/layout/feature-flag-context';
import { AppSidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { SearchProvider } from '@/components/search/search-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

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
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    redirect('/login');
  }

  let activeOrgId = session.session.activeOrganizationId;

  // Auto-activate the first org if none is active
  if (!activeOrgId) {
    const membership = await prisma.member.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },
    });

    if (membership) {
      await auth.api.setActiveOrganization({
        headers: reqHeaders,
        body: { organizationId: membership.organizationId },
      });
      activeOrgId = membership.organizationId;
    }
  }

  // Fetch active org info + user role in parallel (now also pulls the fields
  // needed for feature-flag evaluation: dataRegion, countryCode).
  let activeOrg: OrgInfo | null = null;
  let userRole: string | null = null;
  let flagBag: FlagValues | null = null;

  if (activeOrgId) {
    const [org, member] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: activeOrgId },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          dataRegion: true,
          countryCode: true,
        },
      }),
      prisma.member.findFirst({
        where: { organizationId: activeOrgId, userId: session.user.id },
        select: { role: true },
      }),
    ]);

    activeOrg = org ? { id: org.id, name: org.name, slug: org.slug, logo: org.logo } : null;
    userRole = member?.role ?? null;

    if (org) {
      try {
        flagBag = buildFlagBag({
          userId: session.user.id,
          organizationId: org.id,
          region: org.dataRegion === 'ME' ? 'ME' : 'EU',
          countryCode: org.countryCode ?? undefined,
          role: member?.role ?? undefined,
          authMode: 'session',
        }).values;
      } catch (err) {
        // Evaluator should never throw (Unleash SDK catches internally + stub
        // fallback), but if it does we must not break the entire dashboard.
        // Fail closed: every flag becomes `false`.
        createLogger({ service: 'feature-flags', organizationId: org.id }).error(
          { err },
          'flag bag hydration failed; falling back to fail-closed defaults',
        );
        flagBag = null;
      }
    }
  }

  // Fail-closed default: when there is no active org (edge case during
  // onboarding) or hydration threw, every flag resolves to `false`. A future
  // no-org user cannot accidentally expose a gated feature.
  const resolvedFlagBag: FlagValues = flagBag ?? emptyFlagBag().values;

  return (
    <DashboardProvider activeOrg={activeOrg} userRole={userRole}>
      <FeatureFlagProvider bag={resolvedFlagBag}>
        <BreadcrumbProvider>
          <SearchProvider>
            <SidebarProvider>
              {/* Skip to content link — visible on focus for keyboard users */}
              <a
                href="#main-content"
                className="fixed start-4 top-4 z-[100] -translate-y-16 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0">
                Skip to content
              </a>
              <AppSidebar />
              <SidebarInset>
                <TopBar />
                <BillingOverlay />
                {/* biome-ignore lint/correctness/useUniqueElementIds: skip-link anchor target — singleton layout */}
                <main
                  id="main-content"
                  className="mesh-bg grain-overlay min-w-0 flex-1 overflow-x-hidden p-6">
                  {children}
                  <AppFooter />
                </main>
              </SidebarInset>
            </SidebarProvider>
          </SearchProvider>
        </BreadcrumbProvider>
      </FeatureFlagProvider>
    </DashboardProvider>
  );
}
