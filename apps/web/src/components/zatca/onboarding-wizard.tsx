"use client";

import type { ZatcaOnboardingState } from "@contractor-ops/einvoice";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ComplianceChecks } from "./compliance-checks";
import { ComplianceCsid } from "./compliance-csid";
import { CsrGeneration } from "./csr-generation";
import { ProductionCertificate } from "./production-certificate";
import type { StepDefinition } from "./stepper";
import { Stepper } from "./stepper";
import { TaxDetailsForm } from "./tax-details-form";
import { zatcaTrpc } from "./zatca-trpc";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

// Step definitions are built inside the component to use translations
const STEP_IDS = [
  "tax_details",
  "csr_generation",
  "compliance_csid",
  "compliance_checks",
  "production_certificate",
] as const;

const STEP_TRANSLATION_KEYS: Record<string, { label: string; shortLabel: string }> = {
  tax_details: { label: "steps.taxDetails", shortLabel: "steps.taxDetailsShort" },
  csr_generation: { label: "steps.csrGeneration", shortLabel: "steps.csrGenerationShort" },
  compliance_csid: { label: "steps.complianceCsid", shortLabel: "steps.complianceCsidShort" },
  compliance_checks: { label: "steps.complianceChecks", shortLabel: "steps.complianceChecksShort" },
  production_certificate: { label: "steps.productionCertificate", shortLabel: "steps.productionCertificateShort" },
};

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
  const t = useTranslations("Zatca.onboarding");
  const queryClient = useQueryClient();

  const onboardingSteps: StepDefinition[] = STEP_IDS.map((id) => {
    const keys = STEP_TRANSLATION_KEYS[id];
    return {
      id,
      label: t((keys?.label ?? id) as Parameters<typeof t>[0]),
      shortLabel: t((keys?.shortLabel ?? id) as Parameters<typeof t>[0]),
    };
  });

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
      return Math.min(current + 1, onboardingSteps.length - 1);
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
        <CardTitle className="text-base font-semibold">{t("title")}</CardTitle>
        <Stepper steps={onboardingSteps} currentStep={activeStep} onStepClick={goToStep} />
      </CardHeader>

      <CardContent className="pt-6">
        {/* Step content with slide transition */}
        <div className="transition-all duration-200 ease-out" key={activeStep}>
          {activeStep === 0 && <TaxDetailsForm onSuccess={goNext} onCancel={onCancel} />}
          {activeStep === 1 && <CsrGeneration onSuccess={goNext} onBack={goBack} />}
          {activeStep === 2 && <ComplianceCsid onSuccess={goNext} onBack={goBack} />}
          {activeStep === 3 && <ComplianceChecks onSuccess={goNext} onBack={goBack} />}
          {activeStep === 4 && <ProductionCertificate onSuccess={onComplete} onBack={goBack} />}
        </div>
      </CardContent>
    </Card>
  );
}
