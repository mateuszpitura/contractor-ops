import { usePortalMobileMenu } from './hooks/use-portal-top-bar.js';
import { PortalMobileMenu } from './portal-mobile-menu.js';

interface PortalMobileMenuContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  orgLogo: string | null;
  contractorName: string;
  contractorEmail: string;
}

/**
 * Decision: mutation/effect host. `usePortalMobileMenu` returns navigation +
 * logout callbacks and an `orgSwitcher` viewmodel — no `isPending`/`isError`/
 * `isEmpty` flags to branch on. Sheet visibility is owned by the parent via
 * the `open` prop. Single render path; no variant pick possible at this layer.
 */
export function PortalMobileMenuContainer(props: PortalMobileMenuContainerProps) {
  const menu = usePortalMobileMenu(props.onOpenChange);
  return <PortalMobileMenu {...props} menu={menu} />;
}
