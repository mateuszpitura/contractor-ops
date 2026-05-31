import type { AtelierPageHeaderProps } from '@contractor-ops/ui';
import { AtelierPageHeader } from '@contractor-ops/ui';
import type { LucideIcon } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { usePathname } from '../../i18n/navigation.js';
import { resolvePageNavIcon } from '../../lib/page-nav-icon.js';

export type WorkbenchPageHeaderProps = AtelierPageHeaderProps & {
  /** Override auto-resolved sidebar/portal nav icon. */
  icon?: LucideIcon;
};

/**
 * App workbench page header — forwards to AtelierPageHeader and fills `icon`
 * from the active sidebar (or portal) nav entry when not passed explicitly.
 */
export function WorkbenchPageHeader({ icon, ...props }: WorkbenchPageHeaderProps) {
  const pathname = usePathname();
  const [searchParams] = useSearchParams();
  const resolvedIcon = icon ?? resolvePageNavIcon(pathname, searchParams);

  return <AtelierPageHeader {...props} icon={resolvedIcon} />;
}
