import { render, screen } from '@/test/test-utils';
import { DpdProviderSection } from '../dpd-provider-section';

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({ isLoading: false, data: [] }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    equipment: {
      getCourierConfigs: {
        queryOptions: vi.fn(() => ({ queryKey: ['equipment', 'getCourierConfigs'] })),
      },
    },
  },
}));

vi.mock('./carrier-credential-form', () => ({
  CarrierCredentialForm: ({ carrier, carrierLabel }: { carrier: string; carrierLabel: string }) => (
    <div data-testid={`carrier-form-${carrier}`}>{carrierLabel} Form</div>
  ),
}));

describe('DpdProviderSection', () => {
  it('renders DPD card title', () => {
    render(<DpdProviderSection />);
    expect(screen.getByText('DPD')).toBeInTheDocument();
  });

  it('renders the DPD description', () => {
    render(<DpdProviderSection />);
    expect(screen.getByText('Ship equipment via DPD courier')).toBeInTheDocument();
  });

  it('renders not-configured badge when no config exists', () => {
    render(<DpdProviderSection />);
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });

  it('renders configure button', () => {
    render(<DpdProviderSection />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders as a button element', () => {
    render(<DpdProviderSection />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});
