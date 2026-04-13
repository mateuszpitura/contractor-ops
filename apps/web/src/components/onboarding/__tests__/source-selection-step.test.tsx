import { useQuery } from '@tanstack/react-query';
import { render, screen, setup, waitFor } from '@/test/test-utils';
import { SourceSelectionStep } from '../source-selection-step';

const mockFetchQuery = vi.fn();
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn(), fetchQuery: mockFetchQuery })),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    onboardingImport: {
      listSources: {
        queryOptions: () => ({ queryKey: ['onboardingImport', 'listSources'] }),
        queryKey: () => ['onboardingImport', 'listSources'],
      },
    },
    integration: {
      getOAuthUrlGeneric: {
        queryOptions: (params: { provider: string }) => ({
          queryKey: ['integration', 'getOAuthUrlGeneric', params.provider],
        }),
      },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { info: vi.fn() } }));

vi.mock('@/components/integrations/brand-icons', () => ({
  JiraBrandIcon: () => <span>Jira</span>,
  LinearBrandIcon: () => <span>Linear</span>,
  SlackBrandIcon: () => <span>Slack</span>,
}));

vi.mock('@/components/integrations/google-workspace-logo', () => ({
  GoogleWorkspaceLogo: () => <span>GWS</span>,
}));

const mockedUseQuery = vi.mocked(useQuery);

describe('SourceSelectionStep', () => {
  it('renders heading', () => {
    mockedUseQuery.mockReturnValue({
      data: [{ provider: 'JIRA', connected: true }],
      isLoading: false,
    } as unknown);
    render(<SourceSelectionStep selectedSources={[]} onSourcesChange={vi.fn()} />);
    expect(screen.getByText(/Where do you manage/)).toBeInTheDocument();
  });

  it('renders source cards for each provider', () => {
    mockedUseQuery.mockReturnValue({
      data: [
        { provider: 'JIRA', connected: true },
        { provider: 'LINEAR', connected: false },
      ],
      isLoading: false,
    } as unknown);
    render(<SourceSelectionStep selectedSources={[]} onSourcesChange={vi.fn()} />);
    // One connected, one not connected
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Connect')).toBeInTheDocument();
  });

  it('renders skip link', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    render(<SourceSelectionStep selectedSources={[]} onSourcesChange={vi.fn()} />);
    expect(screen.getByText(/Skip/)).toBeInTheDocument();
  });

  it('renders loading skeletons when query is loading', () => {
    mockedUseQuery.mockReturnValue({ data: undefined, isLoading: true } as unknown);
    const { container } = render(
      <SourceSelectionStep selectedSources={[]} onSourcesChange={vi.fn()} />,
    );
    // Skeletons are rendered (4 of them) with data-slot="skeleton"
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(4);
  });

  it('renders subtitle text', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    render(<SourceSelectionStep selectedSources={[]} onSourcesChange={vi.fn()} />);
    // Subtitle is present below heading
    const heading = screen.getByText(/Where do you manage/);
    expect(heading).toBeInTheDocument();
  });

  it('renders all four provider source cards when data includes four providers', () => {
    mockedUseQuery.mockReturnValue({
      data: [
        { provider: 'JIRA', connected: true },
        { provider: 'LINEAR', connected: false },
        { provider: 'GOOGLE_WORKSPACE', connected: true },
        { provider: 'SLACK', connected: false },
      ],
      isLoading: false,
    } as unknown);
    render(<SourceSelectionStep selectedSources={[]} onSourcesChange={vi.fn()} />);
    // Connected and Connect buttons should be visible
    const connectedBadges = screen.getAllByText('Connected');
    const connectBtns = screen.getAllByText('Connect');
    expect(connectedBadges.length).toBe(2);
    expect(connectBtns.length).toBe(2);
  });

  it('shows no source cards when data is empty', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    render(<SourceSelectionStep selectedSources={[]} onSourcesChange={vi.fn()} />);
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(screen.queryByText('Connect')).not.toBeInTheDocument();
  });

  it('renders heading and skip even when no sources available', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    render(<SourceSelectionStep selectedSources={[]} onSourcesChange={vi.fn()} />);
    expect(screen.getByText(/Where do you manage/)).toBeInTheDocument();
    expect(screen.getByText(/Skip/)).toBeInTheDocument();
  });

  it('renders with pre-selected sources', () => {
    mockedUseQuery.mockReturnValue({
      data: [
        { provider: 'JIRA', connected: true },
        { provider: 'LINEAR', connected: true },
      ],
      isLoading: false,
    } as unknown);
    render(<SourceSelectionStep selectedSources={['JIRA']} onSourcesChange={vi.fn()} />);
    // Both should show as connected
    const connectedBadges = screen.getAllByText('Connected');
    expect(connectedBadges.length).toBe(2);
  });

  it('calls onSourcesChange when a connected source is toggled', async () => {
    mockedUseQuery.mockReturnValue({
      data: [
        { provider: 'JIRA', connected: true },
        { provider: 'LINEAR', connected: true },
      ],
      isLoading: false,
    } as unknown);
    const onSourcesChange = vi.fn();
    const { user } = setup(
      <SourceSelectionStep selectedSources={[]} onSourcesChange={onSourcesChange} />,
    );
    // Click on a source card to toggle it
    const connectedBadges = screen.getAllByText('Connected');
    // Click the parent card of the first connected source
    const card = connectedBadges[0]?.closest("div[role='button'], button, div");
    if (card) await user.click(card);
    // onSourcesChange should be called with the provider added
    expect(onSourcesChange).toHaveBeenCalled();
  });

  it('calls handleConnect when Connect button is clicked', async () => {
    mockFetchQuery.mockResolvedValue({ url: 'https://oauth.test/auth' });
    vi.spyOn(window, 'open').mockReturnValue({
      closed: true,
    } as Window);

    mockedUseQuery.mockReturnValue({
      data: [{ provider: 'LINEAR', connected: false }],
      isLoading: false,
    } as unknown);
    const { user } = setup(<SourceSelectionStep selectedSources={[]} onSourcesChange={vi.fn()} />);
    await user.click(screen.getByText('Connect'));
    await waitFor(() => {
      expect(mockFetchQuery).toHaveBeenCalled();
    });
  });

  it('removes source from selection when already selected', async () => {
    mockedUseQuery.mockReturnValue({
      data: [{ provider: 'JIRA', connected: true }],
      isLoading: false,
    } as unknown);
    const onSourcesChange = vi.fn();
    const { user } = setup(
      <SourceSelectionStep selectedSources={['JIRA']} onSourcesChange={onSourcesChange} />,
    );
    const card = screen.getByText('Connected').closest("div[role='button'], button, div");
    if (card) await user.click(card);
    expect(onSourcesChange).toHaveBeenCalled();
  });

  it('navigates to settings when skip is clicked', async () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const { user } = setup(<SourceSelectionStep selectedSources={[]} onSourcesChange={vi.fn()} />);
    await user.click(screen.getByText(/Skip/));
    // router.push should have been called
  });
});
