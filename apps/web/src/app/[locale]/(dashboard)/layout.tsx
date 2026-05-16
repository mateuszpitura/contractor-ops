import { auth } from '@contractor-ops/auth';
import { prisma } from '@contractor-ops/db';
import type { FlagValues } from '@contractor-ops/feature-flags';
import { buildFlagBag, emptyFlagBag } from '@contractor-ops/feature-flags';
import { createLogger } from '@contractor-ops/logger';
import { unstable_cache } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { BillingOverlay } from '@/components/billing/billing-overlay';
import { AppFooter } from '@/components/layout/app-footer';
import { BreadcrumbProvider } from '@/components/layout/breadcrumb-context';
import type { OrgInfo } from '@/components/layout/dashboard-context';
import { DashboardProvider } from '@/components/layout/dashboard-context';
import { FeatureFlagProvider } from '@/components/layout/feature-flag-context';
import { IntensityRouter } from '@/components/layout/intensity-router';
import { AppSidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { SearchProvider } from '@/components/search/search-provider';
import { TosReacceptanceModal } from '@/components/tos-reacceptance-modal';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TOS_CURRENT_VERSION } from '@/lib/tos';

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
 *
 * F-SCALE-04: the org/member/consent lookups are wrapped in
 * `unstable_cache` keyed by user+org so frequent dashboard navigations
 * don't re-run 4-5 Prisma queries on every render. The TTL is short
 * (60 s) so role changes / consent acceptance propagate quickly; the
 * Better Auth session lookup is already cached by Better Auth itself.
 */

// 60 s tag-able cache for the per-user / per-org lookups that don't
// change often. Shorter than the dashboard KPI cache because role
// changes / ToS acceptance need to be visible faster.
const DASHBOARD_LAYOUT_CACHE_TTL_SECONDS = 60;

const fetchOrgAndMember = (userId: string, activeOrgId: string) =>
  unstable_cache(
    async () => {
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
          where: { organizationId: activeOrgId, userId },
          select: { role: true },
        }),
      ]);
      return { org, member };
    },
    [`dashboard-layout-org-member`, userId, activeOrgId],
    {
      revalidate: DASHBOARD_LAYOUT_CACHE_TTL_SECONDS,
      tags: [`org:${activeOrgId}`, `user:${userId}:org:${activeOrgId}`],
    },
  )();

const fetchLatestTosConsent = (userId: string, activeOrgId: string, version: string) =>
  prisma.consentEvent.findFirst({
    where: {
      userId,
      organizationId: activeOrgId,
      scope: 'TOS',
      version,
    },
    select: { id: true },
    orderBy: { acceptedAt: 'desc' },
  });
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [reqHeaders, locale, tLayout] = await Promise.all([
    headers(),
    getLocale(),
    getTranslations('Layout'),
  ]);
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

  // Fetch org info, user role, and ToS consent in parallel. Flag bag
  // evaluation depends on the org result so it runs after the parallel fan-out.
  let activeOrg: OrgInfo | null = null;
  let userRole: string | null = null;
  let flagBag: FlagValues | null = null;
  let latestTosConsent: { id: string } | null = null;

  if (activeOrgId) {
    const [{ org, member }, tosConsent] = await Promise.all([
      fetchOrgAndMember(session.user.id, activeOrgId),
      fetchLatestTosConsent(session.user.id, activeOrgId, TOS_CURRENT_VERSION),
    ]);

    latestTosConsent = tosConsent;
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
        createLogger({ service: 'feature-flags', organizationId: org.id }).error(
          { err },
          'flag bag hydration failed; falling back to fail-closed defaults',
        );
        flagBag = null;
      }
    }
  }

  // Fail-closed default: when there is no active org (edge case during
  // onboarding) or hydration threw, every flag resolves to `false`.
  const resolvedFlagBag: FlagValues = flagBag ?? emptyFlagBag().values;
  const needsTosAcceptance = !latestTosConsent;

  return (
    <>
      {/* Phase 64 D-30 — ToS re-acceptance modal (non-dismissible) */}
      {needsTosAcceptance && (
        <TosReacceptanceModal currentVersion={TOS_CURRENT_VERSION} locale={locale} />
      )}
      <DashboardProvider activeOrg={activeOrg} userRole={userRole}>
        <FeatureFlagProvider bag={resolvedFlagBag}>
          <BreadcrumbProvider>
            <SearchProvider>
              <SidebarProvider>
                <IntensityRouter>
                  {/* Skip to content link — visible on focus for keyboard users */}
                  <a
                    href="#main-content"
                    className="fixed start-4 top-4 z-[100] -translate-y-16 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0">
                    {tLayout('skipToContent')}
                  </a>
                  <AppSidebar />
                  <SidebarInset>
                    <TopBar />
                    <BillingOverlay />
                    {/*
                     * biome-ignore lint/correctness/useUniqueElementIds: skip-link anchor target — singleton layout
                     *
                     * Background treatment is intensity-aware via [data-intensity]
                     * on <body>: workbench routes get a calm static surface, atelier
                     * routes keep the mesh + grain ambient wash. See globals.css.
                     */}
                    <main
                      id="main-content"
                      className="atelier-main-surface flex min-w-0 flex-1 flex-col overflow-x-hidden p-6">
                      <div className="flex-1 pb-8">{children}</div>
                      <AppFooter />
                    </main>
                  </SidebarInset>
                </IntensityRouter>
              </SidebarProvider>
            </SearchProvider>
          </BreadcrumbProvider>
        </FeatureFlagProvider>
      </DashboardProvider>
    </>
  );
}
