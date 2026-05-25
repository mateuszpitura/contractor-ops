import { usePortalTopBar } from './hooks/use-portal-top-bar.js';
import { PortalTopBar } from './portal-top-bar.js';

interface PortalTopBarContainerProps {
  orgName: string;
  orgLogo?: string | null;
  contractorName: string;
  contractorEmail: string;
}

/**
 * Decision: mutation/effect host. `usePortalTopBar` returns the pathname,
 * org-switcher viewmodel, mobile-menu state, and logout handler. The bar is
 * always visible (no isLoading/isError/isEmpty branch); active-nav highlight
 * lives in the presentational layer. Single render path by design.
 */
export function PortalTopBarContainer(props: PortalTopBarContainerProps) {
  const bar = usePortalTopBar();
  return <PortalTopBar {...props} bar={bar} />;
}
