import { useCallback, useState } from 'react';

/**
 * Generic wizard step navigation with boundary clamping.
 */
export function useWizardSteps(totalSteps: number): {
  currentStep: number;
  goNext: () => void;
  goBack: () => void;
  goTo: (step: number) => void;
  isFirst: boolean;
  isLast: boolean;
  reset: () => void;
} {
  const [currentStep, setCurrentStep] = useState(0);

  const goNext = useCallback(() => {
    setCurrentStep(s => Math.min(s + 1, totalSteps - 1));
  }, [totalSteps]);

  const goBack = useCallback(() => {
    setCurrentStep(s => Math.max(s - 1, 0));
  }, []);

  const goTo = useCallback(
    (step: number) => {
      setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
    },
    [totalSteps],
  );

  const reset = useCallback(() => {
    setCurrentStep(0);
  }, []);

  return {
    currentStep,
    goNext,
    goBack,
    goTo,
    isFirst: currentStep === 0,
    isLast: currentStep === totalSteps - 1,
    reset,
  };
}
