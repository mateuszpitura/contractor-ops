import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ComplianceChecks } from './compliance-checks.js';
import { ComplianceCsid } from './compliance-csid.js';
import { CsrGeneration } from './csr-generation.js';
import type { useOnboardingWizard as UseOnboardingWizard } from './hooks/use-onboarding-wizard.js';
import { useOnboardingWizard } from './hooks/use-onboarding-wizard.js';
import { ProductionCertificate } from './production-certificate.js';
import { Stepper } from './stepper.js';
import { TaxDetailsForm } from './tax-details-form.js';

const ONBOARDING_STEP_COUNT = 5;

export function OnboardingWizardSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-4 border-b">
        <Skeleton className="h-6 w-60" />
        <div className="flex items-center gap-2 md:gap-0">
          {Array.from({ length: ONBOARDING_STEP_COUNT }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <div key={`onboarding-step-skel-${i}`} className="flex items-center gap-2 md:flex-1">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-20" />
              {i < ONBOARDING_STEP_COUNT - 1 && (
                <Skeleton className="hidden h-px w-full min-w-4 md:block md:flex-1 md:mx-2" />
              )}
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </CardContent>
    </Card>
  );
}

export type OnboardingWizardViewProps = {
  onComplete: () => void;
  onCancel: () => void;
} & Omit<ReturnType<typeof UseOnboardingWizard>, 'isLoading'>;

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

export function OnboardingWizard(
  props: Pick<OnboardingWizardViewProps, 'onComplete' | 'onCancel'>,
) {
  const { isLoading, ...rest } = useOnboardingWizard();
  if (isLoading) return <OnboardingWizardSkeleton />;
  return <OnboardingWizardView {...props} {...rest} />;
}
