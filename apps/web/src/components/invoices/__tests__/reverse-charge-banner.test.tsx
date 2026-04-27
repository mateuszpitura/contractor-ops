import { mutationOptions } from '@/test/mocks/trpc';
import { render, screen } from '@/test/test-utils';
import { ReverseChargeBanner } from '../reverse-charge-banner';

function rqKey() {
  return '__rq_reverse_charge_banner__';
}
function rq() {
  return (globalThis as any)[rqKey()] as ReturnType<
    typeof import('@/test/mocks/react-query').createReactQueryMockController
  >;
}

vi.mock('@tanstack/react-query', async () => {
  const { createReactQueryMockController } = await import('@/test/mocks/react-query');
  (globalThis as any)[rqKey()] ??= createReactQueryMockController();
  return rq().factory();
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    invoice: {
      toggleReverseCharge: {
        mutationOptions: (opts?: Record<string, unknown>) => mutationOptions(opts),
      },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('ReverseChargeBanner', () => {
  it('returns null when isReverseCharge is false', () => {
    const { container } = render(<ReverseChargeBanner invoiceId="inv-1" isReverseCharge={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders banner when isReverseCharge is true', () => {
    render(<ReverseChargeBanner invoiceId="inv-1" isReverseCharge />);
    expect(screen.getByText('Reverse charge applied')).toBeInTheDocument();
  });

  it('renders cross-border description text', () => {
    render(<ReverseChargeBanner invoiceId="inv-1" isReverseCharge />);
    expect(screen.getByText(/Cross-border B2B transaction/)).toBeInTheDocument();
  });

  it('renders Override dropdown button', () => {
    render(<ReverseChargeBanner invoiceId="inv-1" isReverseCharge />);
    expect(screen.getByText('Override')).toBeInTheDocument();
  });
});
