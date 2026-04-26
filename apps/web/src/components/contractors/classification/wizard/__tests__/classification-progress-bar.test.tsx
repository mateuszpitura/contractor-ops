import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';

import { ClassificationProgressBar } from '../classification-progress-bar';

describe('ClassificationProgressBar', () => {
  it('renders a progressbar element', () => {
    render(
      <ClassificationProgressBar
        currentStep={1}
        totalSteps={5}
        currentStepCompletion={0.5}
        currentStepLabel="Substitution"
      />,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('sets correct aria-valuenow based on step and completion', () => {
    render(
      <ClassificationProgressBar
        currentStep={3}
        totalSteps={5}
        currentStepCompletion={0.5}
        currentStepLabel="Financial Risk"
      />,
    );

    const bar = screen.getByRole('progressbar');
    // valueNow = currentStep - 1 + completion = 2 + 0.5 = 2.5
    expect(bar).toHaveAttribute('aria-valuenow', '2.5');
  });

  it('sets aria-valuemax to total steps', () => {
    render(
      <ClassificationProgressBar
        currentStep={1}
        totalSteps={4}
        currentStepCompletion={0}
        currentStepLabel="Integration"
      />,
    );

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemax', '4');
  });

  it('sets aria-valuemin to 0', () => {
    render(
      <ClassificationProgressBar
        currentStep={1}
        totalSteps={5}
        currentStepCompletion={0}
        currentStepLabel="Step 1"
      />,
    );

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
  });

  it('clamps currentStepCompletion to [0, 1]', () => {
    render(
      <ClassificationProgressBar
        currentStep={2}
        totalSteps={5}
        currentStepCompletion={1.5}
        currentStepLabel="Control"
      />,
    );

    const bar = screen.getByRole('progressbar');
    // valueNow = 1 + min(max(1.5, 0), 1) = 1 + 1 = 2
    expect(bar).toHaveAttribute('aria-valuenow', '2');
  });

  it('renders a live region for step announcements', () => {
    render(
      <ClassificationProgressBar
        currentStep={1}
        totalSteps={5}
        currentStepCompletion={0}
        currentStepLabel="Substitution"
      />,
    );

    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });
});
