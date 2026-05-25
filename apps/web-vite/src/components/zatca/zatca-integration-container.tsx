/**
 * ZATCA integration settings — Step 10 batch 8 port from
 * apps/web/src/app/[locale]/(dashboard)/settings/integrations/zatca/page.tsx.
 */

import { AtelierPageHeader, IntegrationsIllustration } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from '../../i18n/navigation.js';
import { AnimateIn } from '../shared/animate-in.js';
import { EnvironmentToggle } from './environment-toggle.js';
import { useZatcaIntegrationSettings } from './hooks/use-zatca-integration-settings.js';
import { OnboardingWizard } from './onboarding-wizard-container.js';
import { ZatcaComplianceWidget } from './zatca-compliance-widget-container.js';
import { ZatcaConnectionPill } from './zatca-connection-pill-container.js';
import { ZatcaInvoiceChainTable } from './zatca-invoice-chain-table-container.js';
import { ZatcaStatsCards } from './zatca-stats-cards-container.js';

export function ZatcaIntegrationContainer() {
  const {
    closeWizard,
    isConnected,
    openWizard,
    showConnectPanel,
    showWizard,
    environment,
    environmentLabel,
    setEnvironment,
    handleWizardComplete,
    t,
  } = useZatcaIntegrationSettings();

  return (
    <div className="space-y-6">
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

      {!!showConnectPanel && (
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

      {!!showWizard && (
        <AnimateIn delay={1}>
          <OnboardingWizard onComplete={handleWizardComplete} onCancel={closeWizard} />
        </AnimateIn>
      )}

      {!!isConnected && (
        <>
          <AnimateIn delay={1}>
            <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('dashboard.statusLabel')}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.statusHint')}</p>
              </div>
              <ZatcaConnectionPill />
            </div>
          </AnimateIn>

          {environment === 'sandbox' && (
            <AnimateIn delay={1}>
              <div className="rounded-lg border border-blue-500/30 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
                {t('sandboxBanner')}
              </div>
            </AnimateIn>
          )}

          <AnimateIn delay={1}>
            <ZatcaStatsCards />
          </AnimateIn>

          <AnimateIn delay={2}>
            <ZatcaComplianceWidget connectionStatus={environment} environment={environmentLabel} />
          </AnimateIn>

          <AnimateIn delay={2}>
            <ZatcaInvoiceChainTable />
          </AnimateIn>

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
