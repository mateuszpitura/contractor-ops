"use client";

import type { ZatcaOnboardingState } from "@contractor-ops/einvoice";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AnimateIn } from "@/components/shared/animate-in";
import { Button } from "@/components/ui/button";
import { EnvironmentToggle } from "@/components/zatca/environment-toggle";
import { OnboardingWizard } from "@/components/zatca/onboarding-wizard";
import { ZatcaComplianceWidget } from "@/components/zatca/zatca-compliance-widget";
import { zatcaTrpc } from "@/components/zatca/zatca-trpc";
import { Link } from "@/i18n/navigation";

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
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);

  const stateQuery = useQuery(zatcaTrpc.getOnboardingState.queryOptions());
  const state = stateQuery.data as ZatcaOnboardingState | undefined;
  const isConnected = state?.productionCertActive === true;
  const isOnboarding = state && !state.productionCertActive && state.currentStep !== "tax_details";

  const [environment, setEnvironment] = useState<"sandbox" | "production">(
    isConnected ? "production" : "sandbox",
  );

  function handleWizardComplete() {
    setWizardOpen(false);
    setEnvironment("production");
    queryClient.invalidateQueries({
      queryKey: zatcaTrpc.getOnboardingState.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: zatcaTrpc.getComplianceStats.queryKey(),
    });
    toast.success("ZATCA onboarding complete!");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <AnimateIn delay={0}>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/settings?tab=integrations" />}
            aria-label="Back to integrations"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-display text-xl font-semibold leading-tight tracking-tight">
              ZATCA Integration
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Saudi Arabia e-invoicing compliance
            </p>
          </div>
        </div>
      </AnimateIn>

      {/* Not Connected State */}
      {!(isConnected || isOnboarding || wizardOpen) && (
        <AnimateIn delay={1}>
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
            <div className="rounded-lg bg-muted p-3 mb-4">
              <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Connect to ZATCA</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Submit e-invoices to ZATCA for clearance and reporting. Set up your
              organization&apos;s certificate to get started.
            </p>
            <Button className="mt-6" onClick={() => setWizardOpen(true)}>
              Connect to ZATCA
            </Button>
          </div>
        </AnimateIn>
      )}

      {/* Onboarding In Progress */}
      {(isOnboarding || wizardOpen) && !isConnected && (
        <AnimateIn delay={1}>
          <OnboardingWizard
            onComplete={handleWizardComplete}
            onCancel={() => setWizardOpen(false)}
          />
        </AnimateIn>
      )}

      {/* Connected State */}
      {isConnected && (
        <>
          {/* Sandbox Banner */}
          {environment === "sandbox" && (
            <AnimateIn delay={1}>
              <div className="rounded-lg border border-blue-500/30 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
                Sandbox mode — Test invoices are not submitted to ZATCA. Switch to production when
                ready.
              </div>
            </AnimateIn>
          )}

          {/* Compliance Widget */}
          <AnimateIn delay={1}>
            <ZatcaComplianceWidget
              connectionStatus={environment}
              environment={environment === "production" ? "Production" : "Sandbox"}
            />
          </AnimateIn>

          {/* Environment Toggle */}
          <AnimateIn delay={2}>
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
