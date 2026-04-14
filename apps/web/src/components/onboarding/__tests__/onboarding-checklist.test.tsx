import { useMutation, useQuery } from '@tanstack/react-query';
import { render, screen } from '@/test/test-utils';
import { OnboardingChecklist } from '../onboarding-checklist';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    settings: {
      get: { queryOptions: () => ({ queryKey: ['settings', 'get'] }) },
      update: { mutationOptions: () => ({}) },
    },
    consent: {
      hasRequiredConsents: {
        queryOptions: () => ({ queryKey: ['consent', 'hasRequiredConsents'] }),
      },
    },
  },
}));

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
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
}));

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

describe('OnboardingChecklist', () => {
  beforeEach(() => {
    mockedUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown);
  });

  it('returns null when loading', () => {
    mockedUseQuery.mockReturnValue({ data: undefined, isLoading: true } as unknown);
    const { container } = render(<OnboardingChecklist />);
    expect(container.innerHTML).toBe('');
  });

  it('renders widget when steps remain', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        metadata: { onboardingCompletedSteps: ['org-details'], onboardingDismissed: false },
      },
      isLoading: false,
    } as unknown);
    render(<OnboardingChecklist />);
    expect(screen.getByText('Setup guide')).toBeInTheDocument();
  });

  it('returns null when all steps completed', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        metadata: {
          onboardingCompletedSteps: [
            'org-details',
            'invite-team',
            'add-contractor',
            'configure-approvals',
            'connect-slack',
            'privacyConsent',
          ],
        },
      },
      isLoading: false,
    } as unknown);
    const { container } = render(<OnboardingChecklist />);
    expect(container.innerHTML).toBe('');
  });

  it('shows dismiss button', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        metadata: { onboardingCompletedSteps: [], onboardingDismissed: false },
      },
      isLoading: false,
    } as unknown);
    render(<OnboardingChecklist />);
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });
});
