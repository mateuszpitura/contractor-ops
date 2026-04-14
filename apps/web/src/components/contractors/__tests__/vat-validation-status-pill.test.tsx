import { render, screen } from '@/test/test-utils';
import { VatValidationStatusPill } from '../vat-validation-status-pill';

describe('VatValidationStatusPill', () => {
  it('renders "Valid" badge for valid status', () => {
    render(<VatValidationStatusPill status="valid" validatedAt={new Date().toISOString()} />);
    expect(screen.getByText('Valid')).toBeInTheDocument();
    expect(screen.getByTestId('vat-validation-status-pill')).toHaveAttribute(
      'data-status',
      'valid',
    );
  });

  it('renders "Invalid" badge for invalid status', () => {
    render(<VatValidationStatusPill status="invalid" validatedAt={new Date().toISOString()} />);
    expect(screen.getByText('Invalid')).toBeInTheDocument();
    expect(screen.getByTestId('vat-validation-status-pill')).toHaveAttribute(
      'data-status',
      'invalid',
    );
  });

  it('renders "Stale" badge for stale status', () => {
    render(<VatValidationStatusPill status="stale" validatedAt={new Date().toISOString()} />);
    expect(screen.getByText('Stale')).toBeInTheDocument();
    expect(screen.getByTestId('vat-validation-status-pill')).toHaveAttribute(
      'data-status',
      'stale',
    );
  });

  it('renders "Unavailable" badge for unavailable status', () => {
    render(<VatValidationStatusPill status="unavailable" validatedAt={null} />);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('vat-validation-status-pill')).toHaveAttribute(
      'data-status',
      'unavailable',
    );
  });

  it('renders "Not validated" badge for null status', () => {
    render(<VatValidationStatusPill status={null} validatedAt={null} />);
    expect(screen.getByText('Not validated')).toBeInTheDocument();
    expect(screen.getByTestId('vat-validation-status-pill')).toHaveAttribute(
      'data-status',
      'not-validated',
    );
  });

  it('has correct aria-label', () => {
    render(<VatValidationStatusPill status="valid" validatedAt={new Date().toISOString()} />);
    expect(screen.getByLabelText('VAT validation: Valid')).toBeInTheDocument();
  });

  it('renders destructive variant for invalid status', () => {
    render(<VatValidationStatusPill status="invalid" validatedAt={null} />);
    const pill = screen.getByTestId('vat-validation-status-pill');
    expect(pill).toHaveAttribute('data-status', 'invalid');
  });
});
