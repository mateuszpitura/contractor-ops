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
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ArrowRight, Settings, Unlink, Unplug } from 'lucide-react';
import { Link } from '../../i18n/navigation.js';
import { tKey } from '../../i18n/typed-keys.js';
import { ZatcaBrandIcon } from '../integrations/brand-icons.js';
import type { useZatcaStatusCard } from './hooks/use-zatca-status-card.js';
import { OnboardingWizard } from './onboarding-wizard-container.js';

type HookResult = ReturnType<typeof useZatcaStatusCard>;
type StatusConfig = HookResult['statusConfig'];
type T = HookResult['t'];

export function ZatcaStatusCardSkeleton() {
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

export type ZatcaStatusCardDisconnectedProps = {
  wizardOpen: boolean;
  openWizard: () => void;
  closeWizard: () => void;
  handleWizardComplete: () => void;
  t: T;
};

export function ZatcaStatusCardDisconnected({
  wizardOpen,
  openWizard,
  closeWizard,
  handleWizardComplete,
  t,
}: ZatcaStatusCardDisconnectedProps) {
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
              <Button onClick={openWizard}>{t('connectButton')}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!!wizardOpen && (
        <div className="col-span-full">
          <OnboardingWizard onComplete={handleWizardComplete} onCancel={closeWizard} />
        </div>
      )}
    </>
  );
}

export type ZatcaStatusCardOnboardingProps = ZatcaStatusCardDisconnectedProps & {
  statusConfig: StatusConfig;
};

export function ZatcaStatusCardOnboarding({
  wizardOpen,
  openWizard,
  closeWizard,
  handleWizardComplete,
  statusConfig,
  t,
}: ZatcaStatusCardOnboardingProps) {
  return (
    <>
      <Card className="flex h-full flex-col">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ZatcaBrandIcon className="h-8 w-auto" />
            <h4 className="text-base font-semibold">{t('title')}</h4>
            <Badge variant={statusConfig.variant}>{tKey(t, statusConfig.labelKey)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col space-y-3">
            <p className="text-sm text-muted-foreground">{t('onboardingInProgress')}</p>
            <div className="mt-auto pt-3">
              <Button variant="outline" onClick={openWizard}>
                <ArrowRight className="h-3.5 w-3.5" />
                {t('continueSetup')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!!wizardOpen && (
        <div className="col-span-full">
          <OnboardingWizard onComplete={handleWizardComplete} onCancel={closeWizard} />
        </div>
      )}
    </>
  );
}

export type ZatcaStatusCardConnectedProps = {
  statusConfig: StatusConfig;
  t: T;
};

export function ZatcaStatusCardConnected({ statusConfig, t }: ZatcaStatusCardConnectedProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ZatcaBrandIcon className="h-8 w-auto" />
          <h4 className="text-base font-semibold">{t('title')}</h4>
          <Badge variant={statusConfig.variant}>{tKey(t, statusConfig.labelKey)}</Badge>
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
