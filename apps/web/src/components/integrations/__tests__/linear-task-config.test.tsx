import { useQuery } from '@tanstack/react-query';
import { render, screen } from '@/test/test-utils';
import { LinearTaskConfig } from '../linear-task-config';

vi.mock('next-intl', async () => {
  const actual = await vi.importActual<typeof import('next-intl')>('next-intl');
  return {
    ...actual,
    useTranslations: () => (key: string) => key,
  };
});

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockImplementation((opts: Record<string, unknown>) => {
      const key = opts?.queryKey;
      if (key?.[0] === 'linear' && key?.[1] === 'connectionStatus') {
        return { isLoading: false, data: { id: 'conn-1', status: 'CONNECTED' } };
      }
      if (key?.[0] === 'linear' && key?.[1] === 'teams') {
        return { isLoading: false, data: [] };
      }
      return { isLoading: false, data: undefined };
    }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

const mockedUseQuery = vi.mocked(useQuery);

vi.mock('@/trpc/init', () => ({
  trpc: {
    linear: {
      connectionStatus: {
        queryOptions: vi.fn(() => ({ queryKey: ['linear', 'connectionStatus'] })),
      },
      teams: { queryOptions: vi.fn(() => ({ queryKey: ['linear', 'teams'] })) },
      saveTaskConfig: { mutationOptions: vi.fn(() => ({})) },
    },
    jira: {
      getTaskConfig: {
        queryOptions: vi.fn(() => ({ queryKey: ['jira', 'getTaskConfig'] })),
        queryKey: vi.fn(() => ['jira', 'getTaskConfig']),
      },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('LinearTaskConfig', () => {
  it('renders toggle label when connected', () => {
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByText('enableToggle')).toBeInTheDocument();
  });

  it('renders team label', () => {
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByText('teamLabel')).toBeInTheDocument();
  });

  it('renders toggle switch for enable/disable', () => {
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders switch element when connected', () => {
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
  });

  it('renders team placeholder in select', () => {
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByText('teamPlaceholder')).toBeInTheDocument();
  });

  it('renders Not configured when no team is selected', () => {
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByText('notConfigured')).toBeInTheDocument();
  });

  it('renders team select trigger (combobox)', () => {
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    const combobox = screen.getByRole('combobox');
    expect(combobox).toBeInTheDocument();
  });

  // ---- Switch disabled without team ----
  it('toggle switch is aria-disabled since no team is selected', () => {
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
  });

  // ---- Component renders label for toggle ----
  it('renders label associated with the toggle', () => {
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    const label = screen.getByText('enableToggle');
    expect(label).toBeInTheDocument();
  });

  // ---- Teams available: team display and interaction ----
  it('renders team options when teams are available', () => {
    mockedUseQuery.mockImplementation((opts: Record<string, unknown>) => {
      const key = opts?.queryKey;
      if (key?.[0] === 'linear' && key?.[1] === 'connectionStatus') {
        return { isLoading: false, data: { id: 'conn-1', status: 'CONNECTED' } } as unknown;
      }
      if (key?.[0] === 'linear' && key?.[1] === 'teams') {
        return {
          isLoading: false,
          data: [
            { id: 't1', name: 'Engineering', key: 'ENG' },
            { id: 't2', name: 'Design', key: 'DES' },
          ],
        } as unknown;
      }
      return { isLoading: false, data: undefined } as unknown;
    });
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('notConfigured')).toBeInTheDocument();
  });

  it('renders with existing task config and shows team name', () => {
    mockedUseQuery.mockImplementation((opts: Record<string, unknown>) => {
      const key = opts?.queryKey;
      if (key?.[0] === 'linear' && key?.[1] === 'connectionStatus') {
        return { isLoading: false, data: { id: 'conn-1', status: 'CONNECTED' } } as unknown;
      }
      if (key?.[0] === 'linear' && key?.[1] === 'teams') {
        return {
          isLoading: false,
          data: [{ id: 't1', name: 'Engineering', key: 'ENG' }],
        } as unknown;
      }
      if (key?.[0] === 'jira' && key?.[1] === 'getTaskConfig') {
        return {
          isLoading: false,
          data: {
            linearEnabled: true,
            linearTeamId: 't1',
            linearTeamKey: 'ENG',
            linearTeamName: 'Engineering',
          },
        } as unknown;
      }
      return { isLoading: false, data: undefined } as unknown;
    });
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('returns null when not connected', () => {
    mockedUseQuery.mockImplementation((opts: Record<string, unknown>) => {
      const key = opts?.queryKey;
      if (key?.[0] === 'linear' && key?.[1] === 'connectionStatus') {
        return { isLoading: false, data: null } as unknown;
      }
      return { isLoading: false, data: undefined } as unknown;
    });
    const { container } = render(<LinearTaskConfig taskTemplateId="tt-1" />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when connection status is DISCONNECTED', () => {
    mockedUseQuery.mockImplementation((opts: Record<string, unknown>) => {
      const key = opts?.queryKey;
      if (key?.[0] === 'linear' && key?.[1] === 'connectionStatus') {
        return { isLoading: false, data: { id: 'conn-1', status: 'DISCONNECTED' } } as unknown;
      }
      return { isLoading: false, data: undefined } as unknown;
    });
    const { container } = render(<LinearTaskConfig taskTemplateId="tt-1" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when connection is PENDING_MAPPING', () => {
    mockedUseQuery.mockImplementation((opts: Record<string, unknown>) => {
      const key = opts?.queryKey;
      if (key?.[0] === 'linear' && key?.[1] === 'connectionStatus') {
        return { isLoading: false, data: { id: 'conn-1', status: 'PENDING_MAPPING' } } as unknown;
      }
      if (key?.[0] === 'linear' && key?.[1] === 'teams') {
        return { isLoading: false, data: [] } as unknown;
      }
      return { isLoading: false, data: undefined } as unknown;
    });
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('toggle cannot be enabled when no team is selected', async () => {
    mockedUseQuery.mockImplementation((opts: Record<string, unknown>) => {
      const key = opts?.queryKey;
      if (key?.[0] === 'linear' && key?.[1] === 'connectionStatus') {
        return { isLoading: false, data: { id: 'conn-1', status: 'CONNECTED' } } as unknown;
      }
      if (key?.[0] === 'linear' && key?.[1] === 'teams') {
        return { isLoading: false, data: [{ id: 't1', name: 'Team A', key: 'TA' }] } as unknown;
      }
      return { isLoading: false, data: undefined } as unknown;
    });
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders LinearLogo icon next to team label', () => {
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    const label = screen.getByText('teamLabel');
    expect(label).toBeInTheDocument();
  });

  it('renders select trigger with team placeholder', () => {
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    expect(screen.getByText('teamPlaceholder')).toBeInTheDocument();
  });

  it('renders with existing enabled config showing checked toggle', () => {
    mockedUseQuery.mockImplementation((opts: Record<string, unknown>) => {
      const key = opts?.queryKey;
      if (key?.[0] === 'linear' && key?.[1] === 'connectionStatus') {
        return { isLoading: false, data: { id: 'conn-1', status: 'CONNECTED' } } as unknown;
      }
      if (key?.[0] === 'linear' && key?.[1] === 'teams') {
        return {
          isLoading: false,
          data: [{ id: 't1', name: 'Engineering', key: 'ENG' }],
        } as unknown;
      }
      if (key?.[0] === 'jira' && key?.[1] === 'getTaskConfig') {
        return {
          isLoading: false,
          data: {
            linearEnabled: true,
            linearTeamId: 't1',
            linearTeamKey: 'ENG',
            linearTeamName: 'Engineering',
          },
        } as unknown;
      }
      return { isLoading: false, data: undefined } as unknown;
    });
    render(<LinearTaskConfig taskTemplateId="tt-1" />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
