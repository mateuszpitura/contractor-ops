import { render, screen, setup } from '@/test/test-utils';
import { BillingTab } from '../billing-tab';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let subscriptionData: any = null;
const mockCheckoutMutate = vi.fn();
const mockPortalMutate = vi.fn();
let portalPending = false;

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: subscriptionData, isLoading: false }),
  useMutation: (opts: Record<string, unknown>) => {
    // Differentiate checkout vs portal by checking options shape
    if (opts?.onError?.toString().includes('checkout')) {
      return { mutate: mockCheckoutMutate, isPending: false };
    }
    return { mutate: mockPortalMutate, isPending: portalPending };
  },
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    billing: {
      getSubscription: { queryOptions: () => ({}) },
      createCheckoutSession: { mutationOptions: () => ({}) },
      createPortalSession: { mutationOptions: () => ({}) },
    },
  },
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock child components
vi.mock('../usage-dashboard', () => ({
  UsageDashboard: () => <div data-testid="usage-dashboard" />,
}));

vi.mock('../proration-preview', () => ({
  ProrationPreview: ({ onCancel }: any) => (
    <div data-testid="proration-preview">
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BillingTab', () => {
  beforeEach(() => {
    subscriptionData = null;
    portalPending = false;
    mockCheckoutMutate.mockClear();
    mockPortalMutate.mockClear();
  });

  it('renders the usage dashboard', () => {
    render(<BillingTab />);
    expect(screen.getByTestId('usage-dashboard')).toBeInTheDocument();
  });

  it('does not show manage billing button when no subscription', () => {
    subscriptionData = null;
    render(<BillingTab />);
    expect(screen.queryByRole('button', { name: /manage billing/i })).not.toBeInTheDocument();
  });

  it('shows manage billing button when subscription exists', () => {
    subscriptionData = { tier: 'PRO', status: 'ACTIVE' };
    render(<BillingTab />);
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
  });

  it('calls portal mutation when manage billing is clicked', async () => {
    subscriptionData = { tier: 'PRO', status: 'ACTIVE' };
    const { user } = setup(<BillingTab />);
    await user.click(screen.getByRole('button', { name: /manage billing/i }));
    expect(mockPortalMutate).toHaveBeenCalledTimes(1);
  });

  it('does not show proration preview by default', () => {
    render(<BillingTab />);
    expect(screen.queryByTestId('proration-preview')).not.toBeInTheDocument();
  });

  it('renders usage dashboard always', () => {
    subscriptionData = { tier: 'PRO', status: 'ACTIVE' };
    render(<BillingTab />);
    expect(screen.getByTestId('usage-dashboard')).toBeInTheDocument();
  });

  it('manage billing button is not rendered without subscription even with null tier', () => {
    subscriptionData = null;
    render(<BillingTab />);
    expect(screen.queryByRole('button', { name: /manage billing/i })).not.toBeInTheDocument();
  });

  it('renders separator between sections', () => {
    const { container } = render(<BillingTab />);
    const separators = container.querySelectorAll("[data-slot='separator']");
    expect(separators.length).toBeGreaterThanOrEqual(1);
  });

  it('renders usage dashboard for ENTERPRISE subscription', () => {
    subscriptionData = { tier: 'ENTERPRISE', status: 'ACTIVE' };
    render(<BillingTab />);
    expect(screen.getByTestId('usage-dashboard')).toBeInTheDocument();
  });

  it('shows manage billing for STARTER subscription', () => {
    subscriptionData = { tier: 'STARTER', status: 'ACTIVE' };
    render(<BillingTab />);
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
  });

  it('renders manage billing button for TRIALING subscription', () => {
    subscriptionData = { tier: 'PRO', status: 'TRIALING' };
    render(<BillingTab />);
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
  });

  it('renders manage billing button for PAST_DUE subscription', () => {
    subscriptionData = { tier: 'PRO', status: 'PAST_DUE' };
    render(<BillingTab />);
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
  });

  // ---- Multiple manage billing clicks ----
  it('calls portal mutation on each manage billing click', async () => {
    subscriptionData = { tier: 'PRO', status: 'ACTIVE' };
    const { user } = setup(<BillingTab />);
    const btn = screen.getByRole('button', { name: /manage billing/i });
    await user.click(btn);
    await user.click(btn);
    expect(mockPortalMutate).toHaveBeenCalledTimes(2);
  });

  // ---- Manage billing disabled during pending ----
  it('disables manage billing button when portal mutation is pending', () => {
    subscriptionData = { tier: 'PRO', status: 'ACTIVE' };
    portalPending = true;
    render(<BillingTab />);
    const btn = screen.getByRole('button', { name: /manage billing/i });
    expect(btn).toBeDisabled();
  });

  // ---- Usage dashboard renders with any subscription ----
  it('renders usage dashboard for CANCELED subscription', () => {
    subscriptionData = { tier: 'PRO', status: 'CANCELED' };
    render(<BillingTab />);
    expect(screen.getByTestId('usage-dashboard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
  });
});
