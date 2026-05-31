import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@contractor-ops/ui/components/shadcn/breadcrumb';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { AlertTriangle, ShieldOff } from 'lucide-react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { BacsSubmitterFormContainer } from '../payments/bacs/bacs-submitter-form-container.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { useSettingsPayments } from './hooks/use-settings-payments.js';

export function SettingsPaymentsContainer() {
  const t = useTranslations('Payments.bacs');
  const tSettings = useTranslations('Settings');
  const tPayments = useTranslations('Settings.payments');
  const { canManageSettings, bacsEnabled } = useSettingsPayments();

  if (!canManageSettings) {
    return (
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/settings">{tSettings('title')}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('settingsPageTitle')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldOff aria-hidden="true" className="size-5 text-muted-foreground" />
              {t('settingsPageTitle')}
            </CardTitle>
            <CardDescription>{tPayments('noPermission.description')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/settings">{tSettings('title')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('settingsPageTitle')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <WorkbenchPageHeader title={t('settingsPageTitle')} description={t('settingsPageSubtitle')} />

      {!bacsEnabled && (
        <Alert variant="default" className="border-amber-300/50 bg-amber-500/5">
          <AlertTriangle aria-hidden="true" className="size-5 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-700 dark:text-amber-400">
            {t('featureFlagOffBanner')}
          </AlertTitle>
          <AlertDescription className="text-muted-foreground" />
        </Alert>
      )}

      <BacsSubmitterFormContainer featureEnabled={bacsEnabled} />
    </div>
  );
}
