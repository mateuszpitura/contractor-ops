import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';

const mockUseMutation = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useMutation: mockUseMutation };
});

vi.mock('next-intl', async importOriginal => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: () => (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        title: 'Step 4 of 5: Run Compliance Checks',
        description: 'Submit 6 test invoices to ZATCA compliance endpoint.',
        runChecks: 'Run Compliance Checks',
        resultsLabel: 'Compliance check results',
        back: 'Back',
        next: 'Next',
        'toast.allPassed': 'All checks passed!',
        'toast.someFailed': `${params?.failedCount ?? 0} checks failed`,
        'toast.error': 'Failed to run compliance checks',
        'testLabels.standardTaxInvoice': 'Standard Tax Invoice',
        'testLabels.standardCreditNote': 'Standard Credit Note',
        'testLabels.standardDebitNote': 'Standard Debit Note',
        'testLabels.simplifiedInvoice': 'Simplified Invoice',
        'testLabels.simplifiedCreditNote': 'Simplified Credit Note',
        'testLabels.simplifiedDebitNote': 'Simplified Debit Note',
      };
      return translations[key] ?? key;
    },
  };
});

import { ComplianceChecks } from '../compliance-checks';

describe('ComplianceChecks', () => {
  const defaultProps = {
    onSuccess: vi.fn(),
    onBack: vi.fn(),
  };

  beforeEach(() => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it('renders step title', () => {
    render(<ComplianceChecks {...defaultProps} />);
    expect(screen.getByText('Step 4 of 5: Run Compliance Checks')).toBeInTheDocument();
  });

  it('renders Run Compliance Checks button', () => {
    render(<ComplianceChecks {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Run Compliance Checks' })).toBeInTheDocument();
  });

  it('renders Back button', () => {
    render(<ComplianceChecks {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('renders Next button disabled before checks pass', () => {
    render(<ComplianceChecks {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('calls onBack when Back is clicked', async () => {
    const onBack = vi.fn();
    const { user } = setup(<ComplianceChecks {...defaultProps} onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('disables Run button while pending', () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    });
    render(<ComplianceChecks {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Run Compliance Checks/ })).toBeDisabled();
  });
});
