import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';

import type { ClassificationStepIndicatorStep } from '../classification-step-indicator';
import { ClassificationStepIndicator } from '../classification-step-indicator';

const steps: ClassificationStepIndicatorStep[] = [
  { id: 'substitution', label: 'Substitution' },
  { id: 'control', label: 'Control' },
  { id: 'financial-risk', label: 'Financial Risk' },
  { id: 'part-and-parcel', label: 'Part & Parcel' },
  { id: 'moo', label: 'Mutuality of Obligation' },
];

describe('ClassificationStepIndicator', () => {
  it('renders an ordered list of steps', () => {
    render(<ClassificationStepIndicator steps={steps} currentStep={1} />);

    expect(screen.getByRole('list')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
  });

  it('marks the current step with aria-current="step"', () => {
    render(<ClassificationStepIndicator steps={steps} currentStep={2} />);

    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(items[2]).not.toHaveAttribute('aria-current');
  });

  it('renders step labels', () => {
    render(<ClassificationStepIndicator steps={steps} currentStep={1} />);

    expect(screen.getByText('Substitution')).toBeInTheDocument();
    expect(screen.getByText('Control')).toBeInTheDocument();
  });

  it('renders step numbers', () => {
    render(<ClassificationStepIndicator steps={steps} currentStep={1} />);

    // Step numbers 1-5 are rendered as aria-hidden spans
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    const stepsWithSubtitle: ClassificationStepIndicatorStep[] = [
      { id: 'integration', label: 'Integration', subtitle: '30% Gewichtung' },
      { id: 'entrepreneurial', label: 'Entrepreneurial' },
    ];

    render(<ClassificationStepIndicator steps={stepsWithSubtitle} currentStep={1} />);

    expect(screen.getByText('(30% Gewichtung)')).toBeInTheDocument();
  });
});
