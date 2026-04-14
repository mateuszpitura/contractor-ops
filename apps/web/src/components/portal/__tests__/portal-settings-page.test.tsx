import { render, screen } from '@/test/test-utils';
import { PortalSettingsPage } from '../portal-settings-page';

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({
      data: {
        displayName: 'Jan Kowalski',
        email: 'jan@example.com',
        phone: '+48 123',
        addressLine1: null,
        addressLine2: null,
        city: null,
        postalCode: null,
        countryCode: 'PL',
        billingProfile: {
          bankAccountMasked: '****1234',
          bankName: 'mBank',
          swiftBic: 'BREXPLPW',
          taxId: '1234567890',
        },
        pendingChangeRequest: null,
      },
      isPending: false,
    }),
    useMutation: () => ({ mutateAsync: vi.fn() }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    portal: {
      getProfile: { queryOptions: () => ({ queryKey: ['portal.profile'] }) },
      updateContactInfo: { mutationOptions: () => ({ mutationFn: vi.fn() }) },
      submitFinancialChangeRequest: { mutationOptions: () => ({ mutationFn: vi.fn() }) },
      getNotificationPreferences: { queryOptions: () => ({ queryKey: ['portal.prefs'] }) },
      updateNotificationPreference: { mutationOptions: () => ({ mutationFn: vi.fn() }) },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/portal/profile-section', () => ({
  ProfileSection: ({ title }: { title: string }) => (
    <div data-testid="profile-section">{title}</div>
  ),
}));

vi.mock('@/components/portal/notification-preferences-section', () => ({
  NotificationPreferencesSection: () => <div data-testid="notification-prefs" />,
}));

describe('PortalSettingsPage', () => {
  it('renders page heading', () => {
    render(<PortalSettingsPage />);

    expect(screen.getByText(/settings/i)).toBeInTheDocument();
  });

  it('renders personal info and financial sections', () => {
    render(<PortalSettingsPage />);

    const sections = screen.getAllByTestId('profile-section');
    expect(sections).toHaveLength(2);
  });

  it('renders notification preferences section', () => {
    render(<PortalSettingsPage />);

    expect(screen.getByTestId('notification-prefs')).toBeInTheDocument();
  });

  it('renders subtitle text', () => {
    render(<PortalSettingsPage />);

    expect(screen.getByText(/manage/i)).toBeInTheDocument();
  });
});
