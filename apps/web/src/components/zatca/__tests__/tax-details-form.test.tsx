import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';

vi.mock('@contractor-ops/einvoice', () => ({
  zatcaTaxDetailsSchema: {
    parse: vi.fn(),
  },
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => async () => ({ values: {}, errors: {} }),
}));

import { TaxDetailsForm } from '../tax-details-form';

describe('TaxDetailsForm', () => {
  const defaultProps = {
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders the step title', () => {
    render(<TaxDetailsForm {...defaultProps} />);
    expect(screen.getByText('Step 1 of 5: Organization Tax Details')).toBeInTheDocument();
  });

  it('renders VAT number input with placeholder', () => {
    render(<TaxDetailsForm {...defaultProps} />);
    expect(screen.getByLabelText('VAT Registration Number')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('3XXXXXXXXXXXXX3')).toBeInTheDocument();
  });

  it('renders Arabic org name input', () => {
    render(<TaxDetailsForm {...defaultProps} />);
    expect(screen.getByLabelText('Organization Legal Name (Arabic)')).toBeInTheDocument();
  });

  it('renders address fields', () => {
    render(<TaxDetailsForm {...defaultProps} />);
    expect(screen.getByLabelText('Street')).toBeInTheDocument();
    expect(screen.getByLabelText('City')).toBeInTheDocument();
    expect(screen.getByLabelText('District')).toBeInTheDocument();
    expect(screen.getByLabelText('Postal Code')).toBeInTheDocument();
  });

  it('renders invoice type checkboxes', () => {
    render(<TaxDetailsForm {...defaultProps} />);
    expect(screen.getByText('Standard Tax Invoices (B2B clearance)')).toBeInTheDocument();
    expect(screen.getByText('Simplified Tax Invoices (B2C reporting)')).toBeInTheDocument();
  });

  it('renders Cancel and Next buttons', () => {
    render(<TaxDetailsForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    const { user } = setup(<TaxDetailsForm {...defaultProps} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renders helper text for VAT number', () => {
    render(<TaxDetailsForm {...defaultProps} />);
    expect(
      screen.getByText('15-digit Saudi VAT number starting and ending with 3'),
    ).toBeInTheDocument();
  });
});
