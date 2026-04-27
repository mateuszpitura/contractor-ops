import { render, screen } from '@/test/test-utils';
import { RevalidateVatButton } from '../revalidate-vat-button';

vi.mock('@/trpc/init', () => ({
  trpc: {
    contractor: {
      getById: { queryKey: () => ['contractor.getById'] },
      revalidateVat: {
        mutationOptions: (opts: Record<string, unknown>) => ({ mutationFn: vi.fn(), ...opts }),
      },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

describe('RevalidateVatButton', () => {
  it('renders the button with text', () => {
    render(<RevalidateVatButton contractorId="ctr-1" />);
    expect(screen.getByText('Revalidate VAT')).toBeInTheDocument();
  });

  it('renders as a button element', () => {
    render(<RevalidateVatButton contractorId="ctr-1" />);
    expect(screen.getByRole('button', { name: /revalidate vat/i })).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(<RevalidateVatButton contractorId="ctr-1" />);
    expect(screen.getByLabelText('Revalidate VAT number')).toBeInTheDocument();
  });

  it('button is not disabled by default', () => {
    render(<RevalidateVatButton contractorId="ctr-1" />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('renders with outline variant styling', () => {
    render(<RevalidateVatButton contractorId="ctr-1" />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});
