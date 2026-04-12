import { render, screen } from '@/test/test-utils';
import { NotificationPreferencesSection } from '../notification-preferences-section';

vi.mock('@tanstack/react-query', () => ({
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
}));

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
});
