'use client';

import type { ZatcaOnboardingState } from '@contractor-ops/einvoice/zatca/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Unlink, Unplug } from 'lucide-react';
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
// Status badge mapping
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'info' | 'destructive' | 'outline' }
> = {
  production: { label: 'Production', variant: 'success' },
  sandbox: { label: 'Sandbox', variant: 'warning' },
  compliance: { label: 'Onboarding', variant: 'info' },
  none: { label: 'Not Connected', variant: 'outline' },
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
  const statusConfig = STATUS_CONFIG[certStatus] ?? STATUS_CONFIG.none;

  function handleWizardComplete() {
    setWizardOpen(false);
    queryClient.invalidateQueries({
      queryKey: zatcaTrpc.getOnboardingState.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: zatcaTrpc.getComplianceStats.queryKey(),
    });
    toast.success('ZATCA onboarding complete!');
  }

  if (stateQuery.isLoading) {
    return (
      <Card>
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
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ZatcaBrandIcon className="h-8 w-auto" />
              <h4 className="text-base font-semibold">ZATCA</h4>
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                Disconnected
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Submit e-invoices to ZATCA for clearance and reporting. Set up your
                organization&apos;s certificate to get started.
              </p>
              {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
              <Button onClick={() => setWizardOpen(true)}>Connect ZATCA</Button>
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
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ZatcaBrandIcon className="h-8 w-auto" />
              <h4 className="text-base font-semibold">ZATCA</h4>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Onboarding in progress — continue the setup wizard.
              </p>
              {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
              <Button variant="outline" onClick={() => setWizardOpen(true)}>
                Continue Setup
              </Button>
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ZatcaBrandIcon className="h-8 w-auto" />
          <h4 className="text-base font-semibold">ZATCA</h4>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Saudi Arabia e-invoicing clearance and reporting.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<Link href="/settings/integrations/zatca" />}>
            <Settings className="me-1.5 h-3.5 w-3.5" />
            Manage
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Unplug className="me-1.5 h-3.5 w-3.5" />
                  Disconnect
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Unlink className="size-4" />
                  Disconnect ZATCA
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Disconnect ZATCA: Active invoices will no longer be submitted. Pending submissions
                  will be cancelled. Continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
