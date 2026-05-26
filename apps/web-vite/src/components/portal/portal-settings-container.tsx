import { usePortalSettingsPage } from './hooks/use-portal-settings-page.js';
import {
  PortalSettingsHeader,
  PortalSettingsPage,
  PortalSettingsSkeleton,
} from './portal-settings-page.js';

export function PortalSettingsContainer() {
  const settings = usePortalSettingsPage();

  if (settings.isPending) {
    return (
      <div className="max-w-[640px]">
        <PortalSettingsHeader />
        <PortalSettingsSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-[640px]">
      <PortalSettingsHeader />
      <PortalSettingsPage settings={settings} />
    </div>
  );
}
