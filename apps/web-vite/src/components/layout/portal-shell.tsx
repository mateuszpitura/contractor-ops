import type { CSSProperties } from 'react';
import { Outlet } from 'react-router-dom';

import { useTranslations } from '../../i18n/useTranslations.js';
import { PortalTopBarContainer } from '../portal/portal-top-bar.js';
import { PageLoadingSpinner } from '../shared/page-loading-spinner.js';
import { usePortalShell } from './hooks/use-portal-shell.js';
import { usePortalShellRedirect } from './hooks/use-portal-shell-redirect.js';
import { PortalShellSkeleton } from './portal-shell-skeleton.js';

interface PortalShellProps {
  skipToContentLabel: string;
  isLoading: boolean;
  shellStyle: CSSProperties | undefined;
  topBarProps: {
    orgName: string;
    orgLogo?: string | null;
    contractorName: string;
    contractorEmail: string;
  } | null;
}

export function PortalShell({ skipToContentLabel, isLoading, topBarProps }: PortalShellProps) {
  if (isLoading) {
    return <PageLoadingSpinner />;
  }

  if (!topBarProps) {
    return null;
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <a
        href="#portal-content"
        className="fixed start-4 top-4 z-[100] -translate-y-16 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0">
        {skipToContentLabel}
      </a>
      <div className="shrink-0">
        <PortalTopBarContainer
          orgName={topBarProps.orgName}
          orgLogo={topBarProps.orgLogo}
          contractorName={topBarProps.contractorName}
          contractorEmail={topBarProps.contractorEmail}
        />
      </div>
      {/* biome-ignore lint/correctness/useUniqueElementIds: skip-link target for accessibility */}
      <main id="portal-content" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function PortalShellContainer() {
  const tLayout = useTranslations('Layout');
  const { isLoading, shouldRedirectToLogin, shellStyle, topBarProps } = usePortalShell();

  usePortalShellRedirect(shouldRedirectToLogin);

  if (isLoading) {
    return <PortalShellSkeleton />;
  }
  if (!topBarProps) {
    return null;
  }

  return (
    <PortalShell
      skipToContentLabel={tLayout('skipToContent')}
      isLoading={false}
      shellStyle={shellStyle}
      topBarProps={topBarProps}
    />
  );
}
