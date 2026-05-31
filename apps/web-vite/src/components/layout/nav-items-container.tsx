import { useSearchParams } from 'react-router-dom';

import { usePathname } from '../../i18n/navigation.js';
import { useNavBadges } from './hooks/use-nav-badges.js';
import { useNavItems } from './hooks/use-nav-items.js';
import { NavItems } from './nav-items.js';

export function NavItemsContainer() {
  const pathname = usePathname();
  const [searchParams] = useSearchParams();
  const { groups } = useNavItems(pathname, searchParams);
  const badgeCounts = useNavBadges();

  if (groups.length === 0) return null;

  return <NavItems groups={groups} badgeCounts={badgeCounts} />;
}
