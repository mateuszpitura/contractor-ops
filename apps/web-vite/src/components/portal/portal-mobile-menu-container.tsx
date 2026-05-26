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

// Decision: dialog host — open/onOpenChange gated by PortalTopBarContainer;
// usePortalMobileMenu supplies nav + logout callbacks and orgSwitcher viewmodel.
// No variant flag at this layer.
export function PortalMobileMenuContainer(props: PortalMobileMenuContainerProps) {
  const menu = usePortalMobileMenu(props.onOpenChange);
  return <PortalMobileMenu {...props} menu={menu} />;
}
