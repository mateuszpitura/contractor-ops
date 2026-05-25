import { render, screen } from '@/test/test-utils';

import type { TaxRateOption } from '../hooks/use-vat-rates';
import {
  VatRateSelector,
  VatRateSelectorEmpty,
  VatRateSelectorSkeleton,
} from '../vat-rate-selector';

const sampleRates: TaxRateOption[] = [
  {
    id: '1',
    code: 'SA_STD',
    ratePercent: 15,
    description: 'Standard Rate',
    isDefault: true,
    isExempt: false,
    isReverseCharge: false,
  },
  {
    id: '2',
    code: 'SA_RED',
    ratePercent: 5,
    description: 'Reduced Rate',
    isDefault: false,
    isExempt: false,
    isReverseCharge: false,
  },
  {
    id: '3',
    code: 'ZW',
    ratePercent: 0,
    description: 'Zero rated',
    isDefault: false,
    isExempt: true,
    isReverseCharge: false,
  },
];

describe('VatRateSelector', () => {
  it('renders the select trigger with placeholder when no value', () => {
    render(<VatRateSelector onChange={vi.fn()} rates={sampleRates} />);
    expect(screen.getByText('Select VAT rate')).toBeInTheDocument();
  });

  it('renders the select element as combobox', () => {
    render(<VatRateSelector onChange={vi.fn()} rates={sampleRates} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('disables the combobox when disabled prop is true', () => {
    render(<VatRateSelector onChange={vi.fn()} disabled rates={sampleRates} />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('is not disabled by default', () => {
    render(<VatRateSelector onChange={vi.fn()} rates={sampleRates} />);
    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });

  it('skeleton shows loading indicator', () => {
    render(<VatRateSelectorSkeleton />);
    expect(screen.getByText('Loading rates...')).toBeInTheDocument();
  });

  it('empty view shows no-rates copy', () => {
    render(<VatRateSelectorEmpty />);
    expect(screen.getByText('No tax rates configured')).toBeInTheDocument();
  });
});
