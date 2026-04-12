'use client';

import type { ZatcaOnboardingState } from '@contractor-ops/einvoice';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, ShieldCheck, Unplug } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const statusConfig = STATUS_CONFIG[certStatus] ?? STATUS_CONFIG.none!;

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

  // Not connected state
  if (!(isConnected || isOnboarding)) {
    return (
      <>
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-muted p-2.5">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-base font-semibold">Connect to ZATCA</h3>
              <p className="text-sm text-muted-foreground">
                Submit e-invoices to ZATCA for clearance and reporting. Set up your
                organization&apos;s certificate to get started.
              </p>
            </div>
            <Button onClick={() => setWizardOpen(true)}>Connect to ZATCA</Button>
          </div>
        </Card>

        {wizardOpen && (
          <div className="col-span-full">
            <OnboardingWizard
              onComplete={handleWizardComplete}
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
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950/30">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-base font-semibold">ZATCA (Saudi Arabia)</h3>
              <p className="text-sm text-muted-foreground">
                Onboarding in progress — continue the setup wizard.
              </p>
            </div>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          </div>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
              Continue Setup
            </Button>
          </div>
        </Card>

        {wizardOpen && (
          <div className="col-span-full">
            <OnboardingWizard
              onComplete={handleWizardComplete}
              onCancel={() => setWizardOpen(false)}
            />
          </div>
        )}
      </>
    );
  }

  // Connected state
  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <CardTitle className="text-base font-semibold">ZATCA (Saudi Arabia)</CardTitle>
          </div>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-0">
        {/* Actions */}
        <div className="flex gap-2 pt-2">
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
                <AlertDialogTitle>Disconnect ZATCA</AlertDialogTitle>
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
