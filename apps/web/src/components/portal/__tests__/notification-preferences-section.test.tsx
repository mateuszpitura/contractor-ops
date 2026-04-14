import { render, screen, setup } from '@/test/test-utils';
import { NotificationPreferencesSection } from '../notification-preferences-section';

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({
      data: [
        { category: 'INVOICE_UPDATES', emailEnabled: true },
        { category: 'PAYMENT_CONFIRMATIONS', emailEnabled: false },
        { category: 'CONTRACT_CHANGES', emailEnabled: true },
        { category: 'DOCUMENT_UPLOADS', emailEnabled: true },
        { category: 'SECURITY_ALERTS', emailEnabled: true },
      ],
      isPending: false,
    }),
    useMutation: () => ({ mutate: vi.fn() }),
    useQueryClient: () => ({
      cancelQueries: vi.fn(),
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
    }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    portal: {
      getNotificationPreferences: {
        queryOptions: () => ({ queryKey: ['portal.notifPrefs'] }),
      },
      updateNotificationPreference: {
        mutationOptions: () => ({ mutationFn: vi.fn() }),
      },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

describe('NotificationPreferencesSection', () => {
  it('renders all 5 notification categories', () => {
    render(<NotificationPreferencesSection />);

    // 5 switches rendered
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(5);
  });

  it('renders security alerts as always-on locked toggle', () => {
    render(<NotificationPreferencesSection />);

    const securitySwitch = screen.getByRole('switch', { name: /security/i });
    expect(securitySwitch).toHaveAttribute('aria-disabled', 'true');
    expect(securitySwitch).toHaveAttribute('aria-checked', 'true');
  });

  it('renders the section title', () => {
    render(<NotificationPreferencesSection />);

    expect(screen.getByText(/notification/i)).toBeInTheDocument();
  });

  it('renders category labels for all 5 categories', () => {
    render(<NotificationPreferencesSection />);
    expect(screen.getAllByText(/invoice updates/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/payment confirmations/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/contract changes/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/document uploads/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/security alerts/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders category descriptions', () => {
    render(<NotificationPreferencesSection />);
    // Each category should have a description paragraph
    const muted = document.querySelectorAll('.text-muted-foreground');
    expect(muted.length).toBeGreaterThanOrEqual(5);
  });

  it('shows locked text for security alerts category', () => {
    render(<NotificationPreferencesSection />);
    expect(screen.getByText(/cannot be disabled/i)).toBeInTheDocument();
  });

  it('renders category description text for each preference', () => {
    render(<NotificationPreferencesSection />);
    // Each category has a description — verify at least one is visible
    const descriptions = document.querySelectorAll('.text-muted-foreground');
    expect(descriptions.length).toBeGreaterThanOrEqual(5);
  });
});
