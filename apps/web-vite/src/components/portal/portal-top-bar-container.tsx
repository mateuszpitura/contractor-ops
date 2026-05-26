import { usePortalTopBar } from './hooks/use-portal-top-bar.js';
import { PortalTopBar } from './portal-top-bar.js';

interface PortalTopBarContainerProps {
  orgName: string;
  orgLogo?: string | null;
  contractorName: string;
  contractorEmail: string;
}

// Decision: side-effect setup — usePortalTopBar exposes pathname, org-switcher
// viewmodel, mobile-menu state, and logout handler consumed inline by the bar.
// Always-visible single render path; no variant flag.
export function PortalTopBarContainer(props: PortalTopBarContainerProps) {
  const bar = usePortalTopBar();
  return <PortalTopBar {...props} bar={bar} />;
}
