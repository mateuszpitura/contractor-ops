// apps/web/src/app/[locale]/(dashboard)/settings/payments/page.tsx
//
// Phase 63 · Plan 04 · D-02 + D-06 — Settings → Payments page.
//
// Admin-only (requires `settings:update` permission). Renders the BACS
// submitter configuration form. When the `payments.bacs-enabled` feature
// flag is off, an informational banner is shown above the form and the Save
// button inside the form is disabled (handled by the form component).

'use client';

import { AlertTriangle, ShieldOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFlag } from '@/components/layout/feature-flag-context';
import { BacsSubmitterForm } from '@/components/payments/bacs/bacs-submitter-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermissions } from '@/hooks/use-permissions';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * /settings/payments — UK BACS + EU SEPA submitter configuration.
 *
 * Permission gate: settings:update. Non-admins see a 403-shaped empty state.
 * Feature flag: when payments.bacs-enabled is off, a notice banner is shown
 * above the form.
 */
export default function PaymentSettingsPage() {
  const t = useTranslations('Payments.bacs');
  const tSettings = useTranslations('Settings');
  const bacsEnabled = useFlag('payments.bacs-enabled');
  const { can } = usePermissions();
  const canManageSettings = can('settings', ['update']);

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
            <CardDescription>
              You do not have permission to configure payment exports. Contact your organization
              admin.
            </CardDescription>
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

      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {t('settingsPageTitle')}
        </h1>
        <p className="text-sm text-muted-foreground max-w-3xl">{t('settingsPageSubtitle')}</p>
      </div>

      {!bacsEnabled && (
        <Alert variant="default" className="border-amber-300/50 bg-amber-500/5">
          <AlertTriangle aria-hidden="true" className="size-5 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-700 dark:text-amber-400">
            {t('featureFlagOffBanner')}
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {/* Empty body — the title is sufficient. The Alert component
                puts the icon left, title above, and an empty description spacer. */}
          </AlertDescription>
        </Alert>
      )}

      <BacsSubmitterForm featureEnabled={bacsEnabled} />
    </div>
  );
}
