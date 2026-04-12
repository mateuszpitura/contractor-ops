"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { ZatcaOnboardingState } from "@contractor-ops/einvoice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper, type StepDefinition } from "./stepper";
import { TaxDetailsForm } from "./tax-details-form";
import { CsrGeneration } from "./csr-generation";
import { ComplianceCsid } from "./compliance-csid";
import { ComplianceChecks } from "./compliance-checks";
import { ProductionCertificate } from "./production-certificate";
import { zatcaTrpc } from "./zatca-trpc";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const ONBOARDING_STEPS: StepDefinition[] = [
  { id: "tax_details", label: "Tax Details", shortLabel: "Tax" },
  { id: "csr_generation", label: "CSR Generation", shortLabel: "CSR" },
  { id: "compliance_csid", label: "Compliance CSID", shortLabel: "CSID" },
  { id: "compliance_checks", label: "Compliance Checks", shortLabel: "Checks" },
  { id: "production_certificate", label: "Production Certificate", shortLabel: "Cert" },
];

const STEP_INDEX_MAP: Record<string, number> = {
  tax_details: 0,
  csr_generation: 1,
  compliance_csid: 2,
  compliance_checks: 3,
  production_certificate: 4,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OnboardingWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Onboarding Wizard
// ---------------------------------------------------------------------------

/**
 * ZATCA 5-step onboarding wizard.
 * State loaded from trpc.zatca.getOnboardingState — persists between sessions.
 * Card wrapper with slide animation (200ms).
 * Back navigation allowed to any completed step.
 */
export function OnboardingWizard({ onComplete, onCancel }: OnboardingWizardProps) {
  const queryClient = useQueryClient();

  const stateQuery = useQuery(zatcaTrpc.getOnboardingState.queryOptions());
  const state = stateQuery.data as ZatcaOnboardingState | undefined;

  // Derive initial step from server state
  const serverStep = state?.currentStep ? (STEP_INDEX_MAP[state.currentStep] ?? 0) : 0;
  const [currentStep, setCurrentStep] = useState<number | null>(null);

  // Use server step if local step hasn't been set yet
  const activeStep = currentStep ?? serverStep;

  const goNext = useCallback(() => {
    setCurrentStep((prev) => {
      const current = prev ?? serverStep;
      return Math.min(current + 1, ONBOARDING_STEPS.length - 1);
    });
    // Refresh onboarding state from server
    queryClient.invalidateQueries({
      queryKey: zatcaTrpc.getOnboardingState.queryKey(),
    });
  }, [serverStep, queryClient]);

  const goBack = useCallback(() => {
    setCurrentStep((prev) => {
      const current = prev ?? serverStep;
      return Math.max(current - 1, 0);
    });
  }, [serverStep]);

  const goToStep = useCallback(
    (index: number) => {
      // Only allow going back to completed steps
      if (index < activeStep) {
        setCurrentStep(index);
      }
    },
    [activeStep],
  );

  if (stateQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-4 border-b">
        <CardTitle className="text-base font-semibold">ZATCA Onboarding</CardTitle>
        <Stepper
          steps={ONBOARDING_STEPS}
          currentStep={activeStep}
          onStepClick={goToStep}
        />
      </CardHeader>

      <CardContent className="pt-6">
        {/* Step content with slide transition */}
        <div
          className="transition-all duration-200 ease-out"
          key={activeStep}
        >
          {activeStep === 0 && (
            <TaxDetailsForm onSuccess={goNext} onCancel={onCancel} />
          )}
          {activeStep === 1 && (
            <CsrGeneration onSuccess={goNext} onBack={goBack} />
          )}
          {activeStep === 2 && (
            <ComplianceCsid onSuccess={goNext} onBack={goBack} />
          )}
          {activeStep === 3 && (
            <ComplianceChecks onSuccess={goNext} onBack={goBack} />
          )}
          {activeStep === 4 && (
            <ProductionCertificate onSuccess={onComplete} onBack={goBack} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
