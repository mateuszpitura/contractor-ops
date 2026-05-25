import { useCallback, useMemo, useState } from 'react';

import { usePathname } from '../../../i18n/navigation.js';
import { tHas, tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useSearch } from '../../search/search-provider.js';
import { useBreadcrumbContext } from '../breadcrumb-context.js';

export interface BreadcrumbSegmentView {
  segment: string;
  label: string;
  href: string;
  isLast: boolean;
}

export interface TopBarBreadcrumbView {
  segments: BreadcrumbSegmentView[];
  contractWizardOpen: boolean;
  setContractWizardOpen: (open: boolean) => void;
  openContractWizard: () => void;
  openSearch: () => void;
}

export function useTopBarBreadcrumbs(): TopBarBreadcrumbView {
  const pathname = usePathname();
  const tNav = useTranslations('Navigation');
  const { setOpen: setSearchOpen } = useSearch();
  const { overrides } = useBreadcrumbContext();
  const [contractWizardOpen, setContractWizardOpen] = useState(false);

  const segments = useMemo<BreadcrumbSegmentView[]>(() => {
    const raw = pathname.split('/').filter(Boolean);
    return raw.map((segment, index) => {
      const override = overrides.get(segment);
      let label: string;
      if (override) {
        label = override.label;
      } else if (/^[a-zA-Z0-9_-]{20,}$/.test(segment)) {
        label = '…';
      } else if (tHas(tNav, segment)) {
        label = tKey(tNav, segment);
      } else {
        label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
      }
      const href = `/${raw.slice(0, index + 1).join('/')}`;
      const isLast = index === raw.length - 1;
      return { segment, label, href, isLast };
    });
  }, [pathname, overrides, tNav]);

  const openContractWizard = useCallback(() => {
    setContractWizardOpen(true);
  }, []);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
  }, [setSearchOpen]);

  return {
    segments,
    contractWizardOpen,
    setContractWizardOpen,
    openContractWizard,
    openSearch,
  };
}
