import type { FlagValues } from '@contractor-ops/feature-flags/browser';
import { SidebarInset, SidebarProvider } from '@contractor-ops/ui/components/shadcn/sidebar';
import { Outlet } from 'react-router-dom';

import { TOS_CURRENT_VERSION } from '../../lib/tos.js';
import { BillingOverlayContainer } from '../billing/billing-overlay-container.js';
import { SearchProvider } from '../search/search-provider.js';
import { PageLoadingSpinner } from '../shared/page-loading-spinner.js';
import { TosReacceptanceModalContainer } from '../tos-reacceptance-modal-container.js';
import { AppFooter } from './app-footer.js';
import { BreadcrumbProvider } from './breadcrumb-context.js';
import { CookieConsentBannerContainer } from './cookie-consent-banner-container.js';
import { DashboardProvider } from './dashboard-context.js';
import { FeatureFlagProvider } from './feature-flag-context.js';
import { IntensityRouter } from './intensity-router.js';
import { AppSidebar } from './sidebar.js';
import { TopBarContainer } from './top-bar-container.js';

interface DashboardShellProps {
  skipToContentLabel: string;
  isLoading: boolean;
  activeOrg: { id: string; name: string; slug: string; logo: string | null } | null;
  memberRole: string | null;
  needsTosAcceptance: boolean;
  flagBag: FlagValues;
}

export function DashboardShell({
  skipToContentLabel,
  isLoading,
  activeOrg,
  memberRole,
  needsTosAcceptance,
  flagBag,
}: DashboardShellProps) {
  if (isLoading) {
    return <PageLoadingSpinner />;
  }

  return (
    <>
      {needsTosAcceptance ? (
        <TosReacceptanceModalContainer currentVersion={TOS_CURRENT_VERSION} />
      ) : null}
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
                  <SidebarInset className="flex h-svh max-h-svh min-h-0 flex-col overflow-hidden">
                    <TopBarContainer />
                    <BillingOverlayContainer />
                    <main
                      id="main-content"
                      className="atelier-main-surface flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-6">
                      <div className="flex min-h-0 flex-1 flex-col">
                        <Outlet />
                      </div>
                    </main>
                    <AppFooter />
                  </SidebarInset>
                </IntensityRouter>
                <CookieConsentBannerContainer />
              </SidebarProvider>
            </SearchProvider>
          </BreadcrumbProvider>
        </DashboardProvider>
      </FeatureFlagProvider>
    </>
  );
}
