import { render, screen } from '@/test/test-utils';
import { VatRateSelector } from '../vat-rate-selector';

vi.mock('@/trpc/init', () => ({
  trpc: {
    tax: {
      getRates: {
        useQuery: () => ({
          isLoading: false,
          data: [
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
          ],
        }),
      },
    },
  },
}));

describe('VatRateSelector', () => {
  it('renders the select trigger with placeholder', () => {
    render(<VatRateSelector onChange={vi.fn()} />);
    expect(screen.getByText('Select VAT rate')).toBeInTheDocument();
  });

  it('renders the select element as combobox', () => {
    render(<VatRateSelector onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('disables the select when disabled prop is true', () => {
    render(<VatRateSelector onChange={vi.fn()} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('is not disabled by default', () => {
    render(<VatRateSelector onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });
});
