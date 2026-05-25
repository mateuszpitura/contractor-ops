import { useSearchParams } from 'react-router-dom';

import { usePathname } from '../../i18n/navigation.js';
import { useNavItems } from './hooks/use-nav-items.js';
import { NavItems } from './nav-items.js';

export function NavItemsContainer() {
  const pathname = usePathname();
  const [searchParams] = useSearchParams();
  const { groups } = useNavItems(pathname, searchParams);

  if (groups.length === 0) return null;

  return <NavItems groups={groups} />;
}
