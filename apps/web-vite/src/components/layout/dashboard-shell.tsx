import type { FlagValues } from '@contractor-ops/feature-flags/browser';
import { SidebarInset, SidebarProvider } from '@contractor-ops/ui/components/shadcn/sidebar';
import { Outlet } from 'react-router-dom';

import { useTranslations } from '../../i18n/useTranslations.js';
import { TOS_CURRENT_VERSION } from '../../lib/tos.js';
import { BillingOverlay } from '../billing/billing-overlay.js';
import { SearchProvider } from '../search/search-provider.js';
import { JumpCommandPalette } from '../shared/command-palette.js';
import { TosReacceptanceModal } from '../tos-reacceptance-modal.js';
import { AppFooter } from './app-footer.js';
import { BreadcrumbProvider } from './breadcrumb-context.js';
import { CookieConsentBannerContainer } from './cookie-consent-banner.js';
import { DashboardProvider } from './dashboard-context.js';
import { DashboardShellSkeleton } from './dashboard-shell-skeleton.js';
import { DemoBanner } from './demo-banner.js';
import { FeatureFlagProvider } from './feature-flag-context.js';
import { useAutoActiveOrg } from './hooks/use-auto-active-org.js';
import { useDashboardShell } from './hooks/use-dashboard-shell.js';
import { useFlagBagValues } from './hooks/use-flag-bag.js';
import { IntensityRouter } from './intensity-router.js';
import { AppSidebar } from './sidebar.js';
import { TopBarContainer } from './top-bar.js';

interface DashboardShellProps {
  skipToContentLabel: string;
  activeOrg: { id: string; name: string; slug: string; logo: string | null } | null;
  memberRole: string | null;
  flagBag: FlagValues;
  /** Env-controlled demo flag — renders a persistent read-only banner when true. */
  isDemo: boolean;
}

export function DashboardShell({
  skipToContentLabel,
  activeOrg,
  memberRole,
  flagBag,
  isDemo,
}: DashboardShellProps) {
  return (
    <FeatureFlagProvider bag={flagBag}>
      <DashboardProvider activeOrg={activeOrg} userRole={memberRole}>
        <BreadcrumbProvider>
          <SearchProvider>
            <SidebarProvider>
              <IntensityRouter>
                <a
                  href="#main-content"
                  className="fixed start-4 top-4 z-[100] -translate-y-16 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0">
                  {skipToContentLabel}
                </a>
                <AppSidebar />
                <SidebarInset>
                  {isDemo ? <DemoBanner /> : null}
                  <TopBarContainer />
                  <BillingOverlay />
                  {/*
                   * Page scrolls at the document level (`<body>`) — same as
                   * legacy. The atelier-main-surface ::after grain layer needs
                   * overflow:hidden on the surface itself (set via CSS), which
                   * is incompatible with `overflow-y-auto` on the same element,
                   * so we don't lock the SidebarInset to viewport height +
                   * scroll inside main. Sticky topbar still works because the
                   * scrolling ancestor for `sticky top-0` becomes the viewport.
                   */}
                  <main
                    id="main-content"
                    className="atelier-main-surface flex min-w-0 flex-1 flex-col p-6">
                    {/*
                     * Wrapper participates in the flex chain. List/table pages
                     * declare a `.workbench-list-page` marker on their root
                     * (see `WORKBENCH_TABLE_PAGE_CLASS`); the workbench CSS in
                     * globals.css gates the viewport-bound scroll behaviour on
                     * that marker via `:has()`. Without the marker, this hop
                     * keeps the flex chain alive but main inherits document
                     * scroll — so settings, forms and other tall pages let the
                     * footer breathe with the content instead of getting
                     * pinned at a flex-1 box edge mid-scroll.
                     */}
                    <div className="flex min-h-0 flex-1 flex-col pb-8">
                      <Outlet />
                    </div>
                    <AppFooter />
                  </main>
                </SidebarInset>
              </IntensityRouter>
              <JumpCommandPalette />
              <CookieConsentBannerContainer />
            </SidebarProvider>
          </SearchProvider>
        </BreadcrumbProvider>
      </DashboardProvider>
    </FeatureFlagProvider>
  );
}

export function DashboardShellContainer() {
  const tLayout = useTranslations('Layout');
  const { isLoading, activeOrg, memberRole, activeOrgId, session, needsTosAcceptance, isDemo } =
    useDashboardShell();
  useAutoActiveOrg();
  const flagBag = useFlagBagValues(activeOrgId, session.isPending);

  if (isLoading) {
    return <DashboardShellSkeleton />;
  }

  return (
    <>
      {needsTosAcceptance ? (
        <TosReacceptanceModal currentVersion={TOS_CURRENT_VERSION} />
      ) : null}
      <DashboardShell
        skipToContentLabel={tLayout('skipToContent')}
        activeOrg={activeOrg}
        memberRole={memberRole}
        flagBag={flagBag}
        isDemo={isDemo}
      />
    </>
  );
}
