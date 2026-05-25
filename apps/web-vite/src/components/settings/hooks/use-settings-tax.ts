import { usePermissions } from '../../../hooks/use-permissions.js';
import { useLocale } from '../../../i18n/navigation.js';

export interface UseSettingsTaxResult {
  isLoading: boolean;
  canView: boolean;
  unauthorizedHref: string;
}

/**
 * Resolves the permission gate for the Settings → Tax page. Returns a
 * pre-computed locale-aware unauthorized redirect path so the container
 * keeps `<Navigate>` JSX-only.
 */
export function useSettingsTax(): UseSettingsTaxResult {
  const { can, isLoading } = usePermissions();
  const locale = useLocale();
  const canView = isLoading || can('settings', ['read']);
  return {
    isLoading,
    canView,
    unauthorizedHref: `/${locale}/unauthorized`,
  };
}
