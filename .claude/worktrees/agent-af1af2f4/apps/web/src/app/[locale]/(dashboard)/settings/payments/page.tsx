'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useFlag } from '@/components/layout/feature-flag-context';
import { BacsSubmitterForm } from '@/components/payments/bacs/bacs-submitter-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePermissions } from '@/hooks/use-permissions';

// ---------------------------------------------------------------------------
// Payment Export Settings Page
//
// Phase 63 Plan 04 (D-02, D-06): BACS submitter configuration.
// Gated behind org:settings:write permission and PAY_BACS_ENABLED flag.
// ---------------------------------------------------------------------------

export default function PaymentSettingsPage() {
  const t = useTranslations('Payments');
  const { can } = usePermissions();
  const bacsEnabled = useFlag('payments.bacs-enabled');

  // Non-admin users: 403 empty state
  if (!can('settings', ['write'])) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
        <p className="text-muted-foreground">{t('settingsPermissionDenied')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('settingsTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('settingsDescription')}</p>
      </div>

      {/* Feature flag off banner */}
      {!bacsEnabled && (
        <Alert variant="default">
          <AlertTriangle className="size-4" />
          <AlertDescription>{t('featureFlagOffBanner')}</AlertDescription>
        </Alert>
      )}

      <BacsSubmitterForm disabled={!bacsEnabled} />
    </div>
  );
}
