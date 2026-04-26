import { render, screen } from '@/test/test-utils';
import { BillingOverlay } from '../billing-overlay';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockPush, mockMutate } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockMutate: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/test',
}));

let subscriptionData: unknown = null;

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({ data: subscriptionData }),
    useMutation: (opts: Record<string, unknown>) => ({
      mutate: mockMutate,
      isPending: false,
      ...opts,
    }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    billing: {
      getSubscription: { queryOptions: () => ({}) },
      createCheckoutSession: { mutationOptions: () => ({}) },
    },
  },
}));

// Mock child components to simplify assertions
vi.mock('../trial-banner', () => ({
  TrialBanner: ({ trialEnd }: { trialEnd: Date }) => (
    <div data-testid="trial-banner">Trial ends {trialEnd.toISOString()}</div>
  ),
}));

vi.mock('../soft-block-modal', () => ({
  SoftBlockModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="soft-block-modal">Blocked</div> : null,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BillingOverlay', () => {
  beforeEach(() => {
    subscriptionData = null;
    mockPush.mockClear();
  });

  it('renders nothing when no subscription data', () => {
    const { container } = render(<BillingOverlay />);
    expect(container.innerHTML).toBe('');
  });

  it('renders trial banner when trialing and trial has not expired', () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    subscriptionData = {
      status: 'TRIALING',
      trialEnd: futureDate.toISOString(),
    };
    render(<BillingOverlay />);
    expect(screen.getByTestId('trial-banner')).toBeInTheDocument();
  });

  it('shows soft-block modal when trial has expired', () => {
    const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    subscriptionData = {
      status: 'TRIALING',
      trialEnd: pastDate.toISOString(),
    };
    render(<BillingOverlay />);
    expect(screen.getByTestId('soft-block-modal')).toBeInTheDocument();
  });

  it('shows soft-block modal when subscription is CANCELED', () => {
    subscriptionData = { status: 'CANCELED', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.getByTestId('soft-block-modal')).toBeInTheDocument();
  });

  it('shows past due banner when status is PAST_DUE', () => {
    subscriptionData = { status: 'PAST_DUE', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.getByText('Payment failed.')).toBeInTheDocument();
  });

  it('renders nothing extra when subscription is ACTIVE', () => {
    subscriptionData = { status: 'ACTIVE', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.queryByTestId('trial-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('soft-block-modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment failed.')).not.toBeInTheDocument();
  });

  it('shows soft-block modal when subscription is UNPAID', () => {
    subscriptionData = { status: 'UNPAID', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.getByTestId('soft-block-modal')).toBeInTheDocument();
  });

  it('shows soft-block modal when subscription is INCOMPLETE', () => {
    subscriptionData = { status: 'INCOMPLETE', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.getByTestId('soft-block-modal')).toBeInTheDocument();
  });

  it('shows soft-block modal when subscription is INCOMPLETE_EXPIRED', () => {
    subscriptionData = { status: 'INCOMPLETE_EXPIRED', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.getByTestId('soft-block-modal')).toBeInTheDocument();
  });

  it('shows soft-block modal when subscription is PAUSED', () => {
    subscriptionData = { status: 'PAUSED', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.getByTestId('soft-block-modal')).toBeInTheDocument();
  });

  it('renders go to billing link in past due banner', () => {
    subscriptionData = { status: 'PAST_DUE', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.getByText('Go to billing')).toBeInTheDocument();
  });

  it('past due banner has alert role', () => {
    subscriptionData = { status: 'PAST_DUE', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not show trial banner when trialEnd is null even if trialing', () => {
    subscriptionData = { status: 'TRIALING', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.queryByTestId('trial-banner')).not.toBeInTheDocument();
  });

  // ---- UNPAID shows block ----
  it('shows soft-block modal and not past due banner for UNPAID', () => {
    subscriptionData = { status: 'UNPAID', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.getByTestId('soft-block-modal')).toBeInTheDocument();
    expect(screen.queryByText('Payment failed.')).not.toBeInTheDocument();
  });

  // ---- INCOMPLETE shows block ----
  it('shows soft-block modal and not past due banner for INCOMPLETE', () => {
    subscriptionData = { status: 'INCOMPLETE', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.getByTestId('soft-block-modal')).toBeInTheDocument();
    expect(screen.queryByText('Payment failed.')).not.toBeInTheDocument();
  });

  // ---- PAUSED shows block ----
  it('shows soft-block modal and not trial banner for PAUSED', () => {
    subscriptionData = { status: 'PAUSED', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.getByTestId('soft-block-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('trial-banner')).not.toBeInTheDocument();
  });

  // ---- INCOMPLETE_EXPIRED shows block ----
  it('shows soft-block modal and not trial banner for INCOMPLETE_EXPIRED', () => {
    subscriptionData = { status: 'INCOMPLETE_EXPIRED', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.getByTestId('soft-block-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('trial-banner')).not.toBeInTheDocument();
  });

  // ---- ACTIVE shows nothing ----
  it('does not show any overlay elements for ACTIVE subscription', () => {
    subscriptionData = { status: 'ACTIVE', trialEnd: null };
    const { container } = render(<BillingOverlay />);
    expect(container.innerHTML).toBe('');
  });

  // ---- Past due banner content ----
  it('past due banner shows update payment text', () => {
    subscriptionData = { status: 'PAST_DUE', trialEnd: null };
    render(<BillingOverlay />);
    expect(screen.getByText(/Update your payment method/)).toBeInTheDocument();
  });

  // ---- Trial banner shows correct date ----
  it('trial banner includes trial end date', () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    subscriptionData = {
      status: 'TRIALING',
      trialEnd: futureDate.toISOString(),
    };
    render(<BillingOverlay />);
    expect(screen.getByTestId('trial-banner')).toHaveTextContent(futureDate.toISOString());
  });

  // ---- Go to billing is a button ----
  it('go to billing is a clickable button', () => {
    subscriptionData = { status: 'PAST_DUE', trialEnd: null };
    render(<BillingOverlay />);
    const billingBtn = screen.getByText('Go to billing');
    expect(billingBtn.tagName.toLowerCase()).toBe('button');
  });
});
