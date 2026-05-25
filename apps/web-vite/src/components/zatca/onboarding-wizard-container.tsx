import { useOnboardingWizard } from './hooks/use-onboarding-wizard.js';
import type { OnboardingWizardViewProps } from './onboarding-wizard.js';
import { OnboardingWizardSkeleton, OnboardingWizardView } from './onboarding-wizard.js';

export function OnboardingWizard(
  props: Pick<OnboardingWizardViewProps, 'onComplete' | 'onCancel'>,
) {
  const { isLoading, ...rest } = useOnboardingWizard();
  if (isLoading) return <OnboardingWizardSkeleton />;
  return <OnboardingWizardView {...props} {...rest} />;
}
