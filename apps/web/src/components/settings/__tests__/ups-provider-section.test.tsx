import { render, screen } from '@/test/test-utils';
import { UpsProviderSection } from '../ups-provider-section';

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

describe('UpsProviderSection', () => {
  it('renders UPS card title', () => {
    render(<UpsProviderSection />);
    expect(screen.getByText('UPS')).toBeInTheDocument();
  });

  it('renders the UPS description', () => {
    render(<UpsProviderSection />);
    expect(screen.getByText('Ship equipment via UPS courier')).toBeInTheDocument();
  });

  it('renders not-configured badge when no config exists', () => {
    render(<UpsProviderSection />);
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });

  it('renders configure button', () => {
    render(<UpsProviderSection />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders as a button element', () => {
    render(<UpsProviderSection />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});
