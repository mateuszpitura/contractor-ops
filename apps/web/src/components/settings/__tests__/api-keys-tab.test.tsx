import { render, screen } from '@/test/test-utils';
import { ApiKeysTab } from '../api-keys-tab';

const mockKeys = vi.hoisted(() => [
  {
    id: 'key-1',
    name: 'ERP Integration',
    prefix: 'abc123',
    scopes: ['contractor:read', 'invoice:read'],
    createdBy: { name: 'John Doe' },
    createdAt: '2026-01-15T10:00:00Z',
    lastUsedAt: '2026-04-10T15:30:00Z',
    revokedAt: null,
    expiresAt: null,
  },
]);

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({ isLoading: false, data: mockKeys }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false, reset: vi.fn() }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    apiKey: {
      list: {
        queryOptions: vi.fn(() => ({ queryKey: ['apiKey', 'list'] })),
        queryKey: vi.fn(() => ['apiKey', 'list']),
      },
      create: { mutationOptions: vi.fn((o: object) => o) },
      revoke: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/billing/feature-gate', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('ApiKeysTab', () => {
  it('renders the heading', () => {
    render(<ApiKeysTab />);
    expect(screen.getByText('API Keys')).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(<ApiKeysTab />);
    expect(screen.getByText('Manage API keys for the Enterprise REST API.')).toBeInTheDocument();
  });

  it('renders Create Key button', () => {
    render(<ApiKeysTab />);
    expect(screen.getAllByText('Create Key').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the key table with headers', () => {
    render(<ApiKeysTab />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('Scopes')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders a key row with name', () => {
    render(<ApiKeysTab />);
    expect(screen.getByText('ERP Integration')).toBeInTheDocument();
  });

  it('renders scope badges for the key', () => {
    render(<ApiKeysTab />);
    expect(screen.getByText('contractor:read')).toBeInTheDocument();
    expect(screen.getByText('invoice:read')).toBeInTheDocument();
  });

  it('renders the created by name', () => {
    render(<ApiKeysTab />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('renders active status badge', () => {
    render(<ApiKeysTab />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('renders revoked status badge for revoked key', () => {
    mockKeys.length = 0;
    mockKeys.push({
      id: 'key-2',
      name: 'Old Key',
      prefix: 'xyz789',
      scopes: ['contractor:read'],
      createdBy: { name: 'Jane Smith' },
      createdAt: '2026-01-01T10:00:00Z',
      lastUsedAt: null,
      revokedAt: '2026-03-01T10:00:00Z',
      expiresAt: null,
    });
    render(<ApiKeysTab />);
    expect(screen.getByText('revoked')).toBeInTheDocument();
    // Restore original key
    mockKeys.length = 0;
    mockKeys.push({
      id: 'key-1',
      name: 'ERP Integration',
      prefix: 'abc123',
      scopes: ['contractor:read', 'invoice:read'],
      createdBy: { name: 'John Doe' },
      createdAt: '2026-01-15T10:00:00Z',
      lastUsedAt: '2026-04-10T15:30:00Z',
      revokedAt: null,
      expiresAt: null,
    });
  });

  it('renders expired status badge for expired key', () => {
    mockKeys.length = 0;
    mockKeys.push({
      id: 'key-3',
      name: 'Expired Key',
      prefix: 'exp456',
      scopes: ['document:read'],
      createdBy: { name: 'Bob' },
      createdAt: '2025-01-01T10:00:00Z',
      lastUsedAt: null,
      revokedAt: null,
      expiresAt: '2025-06-01T10:00:00Z',
    });
    render(<ApiKeysTab />);
    expect(screen.getByText('expired')).toBeInTheDocument();
    // Restore original key
    mockKeys.length = 0;
    mockKeys.push({
      id: 'key-1',
      name: 'ERP Integration',
      prefix: 'abc123',
      scopes: ['contractor:read', 'invoice:read'],
      createdBy: { name: 'John Doe' },
      createdAt: '2026-01-15T10:00:00Z',
      lastUsedAt: '2026-04-10T15:30:00Z',
      revokedAt: null,
      expiresAt: null,
    });
  });

  it('renders empty state when no keys exist', () => {
    mockKeys.length = 0;
    render(<ApiKeysTab />);
    expect(screen.getByText('No API keys yet')).toBeInTheDocument();
    expect(screen.getByText(/Create your first API key/)).toBeInTheDocument();
    // Restore original key
    mockKeys.push({
      id: 'key-1',
      name: 'ERP Integration',
      prefix: 'abc123',
      scopes: ['contractor:read', 'invoice:read'],
      createdBy: { name: 'John Doe' },
      createdAt: '2026-01-15T10:00:00Z',
      lastUsedAt: '2026-04-10T15:30:00Z',
      revokedAt: null,
      expiresAt: null,
    });
  });

  it('renders key prefix with co_live_ format', () => {
    render(<ApiKeysTab />);
    expect(screen.getByText(/co_live_abc123/)).toBeInTheDocument();
  });

  it('renders dash for null lastUsedAt', () => {
    mockKeys.length = 0;
    mockKeys.push({
      id: 'key-4',
      name: 'Never Used Key',
      prefix: 'nul000',
      scopes: ['contractor:read'],
      createdBy: { name: 'Alice' },
      createdAt: '2026-04-01T10:00:00Z',
      lastUsedAt: null,
      revokedAt: null,
      expiresAt: null,
    });
    render(<ApiKeysTab />);
    // formatDate returns '—' for null
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
    // Restore
    mockKeys.length = 0;
    mockKeys.push({
      id: 'key-1',
      name: 'ERP Integration',
      prefix: 'abc123',
      scopes: ['contractor:read', 'invoice:read'],
      createdBy: { name: 'John Doe' },
      createdAt: '2026-01-15T10:00:00Z',
      lastUsedAt: '2026-04-10T15:30:00Z',
      revokedAt: null,
      expiresAt: null,
    });
  });

  it('renders key actions button for active keys', () => {
    render(<ApiKeysTab />);
    expect(screen.getByRole('button', { name: 'Key actions' })).toBeInTheDocument();
  });
});
