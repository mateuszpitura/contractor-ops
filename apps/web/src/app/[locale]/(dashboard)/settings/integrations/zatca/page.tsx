'use client';

import type { ZatcaOnboardingState } from '@contractor-ops/einvoice/zatca/types';
import { AtelierPageHeader, IntegrationsIllustration } from '@contractor-ops/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { AnimateIn } from '@/components/shared/animate-in';
import { Button } from '@/components/ui/button';
import { EnvironmentToggle } from '@/components/zatca/environment-toggle';
import { OnboardingWizard } from '@/components/zatca/onboarding-wizard';
import { ZatcaComplianceWidget } from '@/components/zatca/zatca-compliance-widget';
import { ZatcaConnectionPill } from '@/components/zatca/zatca-connection-pill';
import { ZatcaInvoiceChainTable } from '@/components/zatca/zatca-invoice-chain-table';
import { ZatcaStatsCards } from '@/components/zatca/zatca-stats-cards';
import { zatcaTrpc } from '@/components/zatca/zatca-trpc';
import { Link } from '@/i18n/navigation';

// ---------------------------------------------------------------------------
// ZATCA Settings Page
// ---------------------------------------------------------------------------

/**
 * /settings/integrations/zatca
 *
 * Not connected: "Connect to ZATCA" empty state per UI-SPEC copy.
 * Connected: compliance widget + environment toggle + manage actions.
 */
export default function ZatcaSettingsPage() {
  const t = useTranslations('Zatca.page');
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const openWizard = useCallback(() => setWizardOpen(true), []);
  const closeWizard = useCallback(() => setWizardOpen(false), []);

  const stateQuery = useQuery(zatcaTrpc.getOnboardingState.queryOptions());
  const state = stateQuery.data as ZatcaOnboardingState | undefined;
  const isConnected = state?.productionCertActive === true;
  const isOnboarding = state && !state.productionCertActive && state.currentStep !== 'tax_details';

  const [environment, setEnvironment] = useState<'sandbox' | 'production'>(
    isConnected ? 'production' : 'sandbox',
  );

  function handleWizardComplete() {
    setWizardOpen(false);
    setEnvironment('production');
    queryClient.invalidateQueries({
      queryKey: zatcaTrpc.getOnboardingState.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: zatcaTrpc.getComplianceStats.queryKey(),
    });
    toast.success(t('toast.onboardingComplete'));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <AnimateIn delay={0}>
        <AtelierPageHeader
          title={t('title')}
          description={t('description')}
          actions={
            <Button
              variant="ghost"
              size="icon"
              render={<Link href="/settings?tab=integrations" />}
              aria-label={t('backAriaLabel')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          }
        />
      </AnimateIn>

      {/* Not Connected State */}
      {!(isConnected || isOnboarding || wizardOpen) && (
        <AnimateIn delay={1}>
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
            <div className="text-primary/70">
              <IntegrationsIllustration className="h-24 w-24" />
            </div>
            <h2 className="mt-5 text-lg font-semibold">{t('connectTitle')}</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">{t('connectDescription')}</p>
            <Button className="mt-6" onClick={openWizard}>
              {t('connectButton')}
            </Button>
          </div>
        </AnimateIn>
      )}

      {/* Onboarding In Progress */}
      {(isOnboarding || wizardOpen) && !isConnected && (
        <AnimateIn delay={1}>
          <OnboardingWizard onComplete={handleWizardComplete} onCancel={closeWizard} />
        </AnimateIn>
      )}

      {/* Connected State */}
      {isConnected && (
        <>
          {/* Status header — connection pill */}
          <AnimateIn delay={1}>
            <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('dashboard.statusLabel')}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.statusHint')}</p>
              </div>
              <ZatcaConnectionPill />
            </div>
          </AnimateIn>

          {/* Sandbox Banner */}
          {environment === 'sandbox' && (
            <AnimateIn delay={1}>
              <div className="rounded-lg border border-blue-500/30 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
                {t('sandboxBanner')}
              </div>
            </AnimateIn>
          )}

          {/* Stats summary cards */}
          <AnimateIn delay={1}>
            <ZatcaStatsCards />
          </AnimateIn>

          {/* Compliance Widget */}
          <AnimateIn delay={2}>
            <ZatcaComplianceWidget
              connectionStatus={environment}
              environment={environment === 'production' ? 'Production' : 'Sandbox'}
            />
          </AnimateIn>

          {/* Invoice chain table with per-row resubmit */}
          <AnimateIn delay={2}>
            <ZatcaInvoiceChainTable />
          </AnimateIn>

          {/* Environment Toggle */}
          <AnimateIn delay={3}>
            <EnvironmentToggle
              value={environment}
              onChange={setEnvironment}
              productionReady={isConnected}
            />
          </AnimateIn>
        </>
      )}
    </div>
  );
}
