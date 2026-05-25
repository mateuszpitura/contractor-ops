import { usePortalSettingsPage } from './hooks/use-portal-settings-page.js';
import {
  PortalSettingsHeader,
  PortalSettingsPage,
  PortalSettingsSkeleton,
} from './portal-settings-page.js';

export function PortalSettingsContainer() {
  const settings = usePortalSettingsPage();

  return (
    <div className="max-w-[640px]">
      <PortalSettingsHeader />
      {settings.isPending ? <PortalSettingsSkeleton /> : <PortalSettingsPage settings={settings} />}
    </div>
  );
}
