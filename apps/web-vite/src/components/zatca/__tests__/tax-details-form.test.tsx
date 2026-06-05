/**
 * TaxDetailsFormView still owns react-hook-form locally (zodResolver +
 * default field state). The split moved the tRPC `saveTaxDetails`
 * mutation into the hook (`useTaxDetailsForm`) — we inject a no-op
 * submitTaxDetails for the test.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { useTranslations } from '../../../i18n/useTranslations';

import { TaxDetailsFormView } from '../tax-details-form';

type ViewProps = React.ComponentProps<typeof TaxDetailsFormView>;

interface Overrides {
  defaultValues?: ViewProps['defaultValues'];
  isPending?: boolean;
  submitTaxDetails?: ViewProps['submitTaxDetails'];
  onSuccess?: () => void;
  onCancel?: () => void;
}

function Harness(props: Overrides) {
  const t = useTranslations('Zatca.taxDetailsForm');
  return (
    <TaxDetailsFormView
      defaultValues={props.defaultValues}
      onSuccess={props.onSuccess ?? vi.fn()}
      onCancel={props.onCancel ?? vi.fn()}
      submitTaxDetails={props.submitTaxDetails ?? vi.fn()}
      isPending={props.isPending ?? false}
      t={t}
    />
  );
}

describe('TaxDetailsForm (web-vite)', () => {
  it('renders the step title', () => {
    render(<Harness />);
    expect(screen.getByText('Step 1 of 5: Organization Tax Details')).toBeInTheDocument();
  });

  it('renders VAT number input with placeholder', () => {
    render(<Harness />);
    expect(screen.getByLabelText('VAT Registration Number')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('3XXXXXXXXXXXXX3')).toBeInTheDocument();
  });

  it('renders Arabic org name input', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Organization Legal Name (Arabic)')).toBeInTheDocument();
  });

  it('renders address fields', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Street')).toBeInTheDocument();
    expect(screen.getByLabelText('City')).toBeInTheDocument();
    expect(screen.getByLabelText('District')).toBeInTheDocument();
    expect(screen.getByLabelText('Postal Code')).toBeInTheDocument();
  });

  it('renders invoice type checkbox labels', () => {
    render(<Harness />);
    expect(screen.getByText('Standard Tax Invoices (B2B clearance)')).toBeInTheDocument();
    expect(screen.getByText('Simplified Tax Invoices (B2C reporting)')).toBeInTheDocument();
  });

  it('renders Cancel and Next buttons', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    const { user } = setup(<Harness onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renders helper text for VAT number', () => {
    render(<Harness />);
    expect(
      screen.getByText('15-digit Saudi VAT number starting and ending with 3'),
    ).toBeInTheDocument();
  });

  it('renders fieldset legends', () => {
    render(<Harness />);
    expect(screen.getByText('Organization Address')).toBeInTheDocument();
    expect(screen.getByText('Invoice Types')).toBeInTheDocument();
  });

  it('accepts defaultValues prop for pre-filling', () => {
    render(
      <Harness
        defaultValues={{
          vatNumber: '300000000000003',
          orgNameArabic: 'شركة',
          street: 'King Fahd Rd',
          city: 'Riyadh',
          district: 'Al Olaya',
          postalCode: '12345',
          invoiceTypes: ['standard'],
        }}
      />,
    );
    expect(screen.getByLabelText('VAT Registration Number')).toHaveValue('300000000000003');
    expect(screen.getByLabelText('Organization Legal Name (Arabic)')).toHaveValue('شركة');
    expect(screen.getByLabelText('Street')).toHaveValue('King Fahd Rd');
    expect(screen.getByLabelText('City')).toHaveValue('Riyadh');
  });

  it('disables the Next button while isPending', () => {
    render(<Harness isPending />);
    expect(screen.getByRole('button', { name: /^next$/i })).toBeDisabled();
  });
});
