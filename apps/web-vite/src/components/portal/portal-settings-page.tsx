import { Card } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalSettingsPage } from './hooks/use-portal-settings-page.js';
import { NotificationPreferencesSectionContainer } from './notification-preferences-section.js';
import type { ProfileField } from './profile-section.js';
import { ProfileSection } from './profile-section.js';

const SETTINGS_CARD_SKELETON_KEYS = ['c1', 'c2', 'c3'] as const;
const SETTINGS_FIELD_SKELETON_KEYS = ['f1', 'f2', 'f3', 'f4'] as const;

export function PortalSettingsSkeleton() {
  return (
    <div className="space-y-4">
      {SETTINGS_CARD_SKELETON_KEYS.map(cardKey => (
        <Card key={cardKey}>
          <div className="flex min-h-[48px] items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <Skeleton className="h-4 w-40" />
            <div className="ms-auto">
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <div className="space-y-3 border-t px-4 py-4">
            {SETTINGS_FIELD_SKELETON_KEYS.map(fieldKey => (
              <div key={`${cardKey}-${fieldKey}`} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function PortalSettingsHeader() {
  const t = useTranslations('Portal');
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold">{t('settings.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
    </div>
  );
}

interface PortalSettingsPageProps {
  settings: ReturnType<typeof usePortalSettingsPage>;
}

export function PortalSettingsPage({ settings }: PortalSettingsPageProps) {
  const t = useTranslations('Portal');

  return (
    <div className="space-y-4">
      <ProfileSection
        title={t('settings.personalInfo')}
        fields={settings.personalFields as ProfileField[]}
        onSave={settings.onContactSave}
        defaultOpen
      />

      <ProfileSection
        title={t('settings.financialDetails')}
        fields={settings.financialFields as ProfileField[]}
        requiresApproval
        onSave={settings.onFinancialSave}
        pendingChangeRequest={settings.pendingChangeRequest}
        defaultOpen
      />

      <NotificationPreferencesSectionContainer />
    </div>
  );
}

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

/** @deprecated Use PortalSettings */
export { PortalSettingsContainer as PortalSettings };
