import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ComplianceChecks } from './compliance-checks-container.js';
import { ComplianceCsid } from './compliance-csid-container.js';
import { CsrGeneration } from './csr-generation-container.js';
import type { useOnboardingWizard } from './hooks/use-onboarding-wizard.js';
import { ProductionCertificate } from './production-certificate-container.js';
import { Stepper } from './stepper.js';
import { TaxDetailsForm } from './tax-details-form-container.js';

export function OnboardingWizardSkeleton() {
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

export type OnboardingWizardViewProps = {
  onComplete: () => void;
  onCancel: () => void;
} & Omit<ReturnType<typeof useOnboardingWizard>, 'isLoading'>;

export function OnboardingWizardView({
  onComplete,
  onCancel,
  onboardingSteps,
  activeStep,
  goNext,
  goBack,
  goToStep,
  t,
}: OnboardingWizardViewProps) {
  return (
    <Card>
      <CardHeader className="space-y-4 border-b">
        <CardTitle className="text-base font-semibold">{t('title')}</CardTitle>
        <Stepper steps={onboardingSteps} currentStep={activeStep} onStepClick={goToStep} />
      </CardHeader>

      <CardContent className="pt-6">
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
