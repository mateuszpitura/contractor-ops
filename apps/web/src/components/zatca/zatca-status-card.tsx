'use client';

import type { ZatcaOnboardingState } from '@contractor-ops/einvoice/zatca/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Settings, Unlink, Unplug } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ZatcaBrandIcon } from '@/components/integrations/brand-icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { OnboardingWizard } from './onboarding-wizard';
import { zatcaTrpc } from './zatca-trpc';

// ---------------------------------------------------------------------------
// Status badge variant mapping (labels resolved via i18n)
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<
  string,
  { variant: 'success' | 'warning' | 'info' | 'destructive' | 'outline'; labelKey: string }
> = {
  production: { variant: 'success', labelKey: 'statusLabels.production' },
  sandbox: { variant: 'warning', labelKey: 'statusLabels.sandbox' },
  compliance: { variant: 'info', labelKey: 'statusLabels.onboarding' },
  none: { variant: 'outline', labelKey: 'statusLabels.notConnected' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ZATCA integration card for Settings > Integrations grid.
 * - Not connected: shows empty state with "Connect to ZATCA" CTA
 * - Connected: shows status, environment, certificate info
 * Pattern matches PeppolStatusCard / KsefProviderSection.
 */
export function ZatcaStatusCard() {
  const t = useTranslations('Zatca.statusCard');
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);

  const stateQuery = useQuery(zatcaTrpc.getOnboardingState.queryOptions());
  const state = stateQuery.data as ZatcaOnboardingState | undefined;
  const isConnected = state?.productionCertActive === true;
  const isOnboarding = state && !state.productionCertActive && state.currentStep !== 'tax_details';
  const certStatus = state?.productionCertActive
    ? 'production'
    : state?.complianceCsidReceived
      ? 'compliance'
      : 'none';
  const statusConfig = STATUS_VARIANT[certStatus] ?? STATUS_VARIANT.none;

  function handleWizardComplete() {
    setWizardOpen(false);
    queryClient.invalidateQueries({
      queryKey: zatcaTrpc.getOnboardingState.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: zatcaTrpc.getComplianceStats.queryKey(),
    });
    toast.success(t('toast.onboardingComplete'));
  }

  if (stateQuery.isLoading) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded" />
            <Skeleton className="h-5 w-16" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-2 h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  // Not connected state
  if (!(isConnected || isOnboarding)) {
    return (
      <>
        <Card className="flex h-full flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ZatcaBrandIcon className="h-8 w-auto" />
              <h4 className="text-base font-semibold">{t('title')}</h4>
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                {t('disconnected')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col space-y-3">
              <p className="text-sm text-muted-foreground">{t('description')}</p>
              <div className="mt-auto pt-3">
                {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
                <Button onClick={() => setWizardOpen(true)}>{t('connectButton')}</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {!!wizardOpen && (
          <div className="col-span-full">
            <OnboardingWizard
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onComplete={handleWizardComplete}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onCancel={() => setWizardOpen(false)}
            />
          </div>
        )}
      </>
    );
  }

  // Onboarding in progress
  if (isOnboarding && !isConnected) {
    return (
      <>
        <Card className="flex h-full flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ZatcaBrandIcon className="h-8 w-auto" />
              <h4 className="text-base font-semibold">{t('title')}</h4>
              <Badge variant={statusConfig.variant}>
                {t(statusConfig.labelKey as Parameters<typeof t>[0])}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col space-y-3">
              <p className="text-sm text-muted-foreground">{t('onboardingInProgress')}</p>
              <div className="mt-auto pt-3">
                {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
                <Button variant="outline" onClick={() => setWizardOpen(true)}>
                  <ArrowRight className="h-3.5 w-3.5" />
                  {t('continueSetup')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {!!wizardOpen && (
          <div className="col-span-full">
            <OnboardingWizard
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onComplete={handleWizardComplete}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onCancel={() => setWizardOpen(false)}
            />
          </div>
        )}
      </>
    );
  }

  // Connected state
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ZatcaBrandIcon className="h-8 w-auto" />
          <h4 className="text-base font-semibold">{t('title')}</h4>
          <Badge variant={statusConfig.variant}>
            {t(statusConfig.labelKey as Parameters<typeof t>[0])}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col space-y-3">
        <p className="text-sm text-muted-foreground">{t('description')}</p>
        <div className="mt-auto flex gap-2 pt-3">
          <Button variant="outline" size="sm" render={<Link href="/settings/integrations/zatca" />}>
            <Settings className="me-1.5 h-3.5 w-3.5" />
            {t('manageButton')}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Unplug className="me-1.5 h-3.5 w-3.5" />
                  {t('disconnectButton')}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Unlink className="size-4" />
                  {t('disconnectDialog.title')}
                </AlertDialogTitle>
                <AlertDialogDescription>{t('disconnectDialog.description')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('disconnectDialog.cancel')}</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {t('disconnectDialog.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
