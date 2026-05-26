/**
 * Web-vite port of apps/web/src/components/zatca/__tests__/stepper.test.tsx.
 *
 * Stepper is a self-contained presentational component that reads only
 * `Zatca.stepper` translations. Harness wires the EN bundle.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';

import type { StepDefinition } from '../stepper';
import { Stepper } from '../stepper';

const STEPS: StepDefinition[] = [
  { id: 'step1', label: 'Tax Details', shortLabel: 'Tax' },
  { id: 'step2', label: 'CSR Generation', shortLabel: 'CSR' },
  { id: 'step3', label: 'Compliance CSID', shortLabel: 'CSID' },
  { id: 'step4', label: 'Compliance Checks', shortLabel: 'Checks' },
  { id: 'step5', label: 'Production Cert', shortLabel: 'Cert' },
];

describe('Stepper (web-vite)', () => {
  it('renders all step short labels', () => {
    render(<Stepper steps={STEPS} currentStep={0} />);
    for (const step of STEPS) {
      expect(screen.getByText(step.shortLabel ?? step.label)).toBeInTheDocument();
    }
  });

  it('marks current step with aria-current="step"', () => {
    render(<Stepper steps={STEPS} currentStep={2} />);
    const currentTab = screen.getByRole('tab', { name: /Step 3/ });
    expect(currentTab).toHaveAttribute('aria-current', 'step');
  });

  it('marks completed steps as aria-selected false and not disabled', () => {
    render(<Stepper steps={STEPS} currentStep={2} />);
    const completedTab = screen.getByRole('tab', { name: /Step 1/ });
    expect(completedTab).toHaveAttribute('aria-selected', 'false');
    expect(completedTab).not.toBeDisabled();
  });

  it('disables future steps', () => {
    render(<Stepper steps={STEPS} currentStep={1} />);
    const futureTab = screen.getByRole('tab', { name: /Step 4/ });
    expect(futureTab).toBeDisabled();
  });

  it('exposes tablist role with localized aria-label', () => {
    render(<Stepper steps={STEPS} currentStep={0} />);
    expect(screen.getByRole('tablist', { name: 'Onboarding progress' })).toBeInTheDocument();
  });

  it('calls onStepClick when a completed step is clicked', async () => {
    const onClick = vi.fn();
    const { user } = setup(<Stepper steps={STEPS} currentStep={3} onStepClick={onClick} />);
    const firstStep = screen.getByRole('tab', { name: /Step 1/ });
    await user.click(firstStep);
    expect(onClick).toHaveBeenCalledWith(0);
  });

  it('does not call onStepClick for future steps (disabled)', async () => {
    const onClick = vi.fn();
    const { user } = setup(<Stepper steps={STEPS} currentStep={1} onStepClick={onClick} />);
    const futureStep = screen.getByRole('tab', { name: /Step 4/ });
    await user.click(futureStep);
    expect(onClick).not.toHaveBeenCalled();
  });
});
