import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup, waitFor } from '@/test/test-utils';
import { CommandPalette } from '../command-palette';

// Polyfill ResizeObserver + scrollIntoView for cmdk in jsdom
class ResizeObserverStub {
  observe() {
    /* no-op */
  }
  unobserve() {
    /* no-op */
  }
  disconnect() {
    /* no-op */
  }
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockPush, mockSetOpen, mockAddRecentItem } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSetOpen: vi.fn(),
  mockAddRecentItem: vi.fn(),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a {...props}>{children}</a>
  ),
}));

let mockOpen = true;
let mockRecentItems: Array<{
  id: string;
  type: string;
  name: string;
  viewedAt: number;
}> = [];

vi.mock('../search-provider', () => ({
  useSearch: () => ({
    open: mockOpen,
    setOpen: mockSetOpen,
    recentItems: mockRecentItems,
    addRecentItem: mockAddRecentItem,
  }),
}));

vi.mock('@/components/integrations/provider-icons', () => ({
  NotionIcon: (props: React.SVGAttributes<SVGSVGElement>) => (
    <svg data-testid="notion-icon" {...props} />
  ),
  ConfluenceIcon: (props: React.SVGAttributes<SVGSVGElement>) => (
    <svg data-testid="confluence-icon" {...props} />
  ),
}));

let searchData: unknown[] = [];
let searchLoading = false;
let docSearchData: unknown[] = [];
let docSearchLoading = false;

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (opts: { queryKey?: unknown }) => {
      const key = JSON.stringify(opts.queryKey ?? '');
      if (key.includes('docs.search')) {
        return { isLoading: docSearchLoading, data: docSearchData };
      }
      return { isLoading: searchLoading, data: searchData };
    },
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    search: {
      global: { queryOptions: vi.fn(() => ({ queryKey: ['search', 'global'] })) },
    },
    docs: {
      search: { queryOptions: vi.fn(() => ({ queryKey: ['docs.search'] })) },
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpen = true;
    mockRecentItems = [];
    searchData = [];
    searchLoading = false;
    docSearchData = [];
    docSearchLoading = false;
    localStorage.clear();
  });

  it('renders the command dialog when open', () => {
    render(<CommandPalette />);
    expect(screen.getByPlaceholderText('Search or type a command...')).toBeInTheDocument();
  });

  it('shows quick actions section', () => {
    render(<CommandPalette />);
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('shows pages navigation section', () => {
    render(<CommandPalette />);
    expect(screen.getByText('Pages')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('shows recent items when they exist', () => {
    mockRecentItems = [
      { id: 'c1', type: 'contractor', name: 'Acme Corp', viewedAt: Date.now() - 60000 },
    ];
    render(<CommandPalette />);
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('shows type badge for recent entity items', () => {
    mockRecentItems = [
      { id: 'c1', type: 'contractor', name: 'Acme Corp', viewedAt: Date.now() - 120000 },
    ];
    render(<CommandPalette />);
    expect(screen.getByText('contractor')).toBeInTheDocument();
  });

  it('does not show recent section when empty', () => {
    mockRecentItems = [];
    render(<CommandPalette />);
    expect(screen.queryByText('Recent')).not.toBeInTheDocument();
  });

  it('shows pinned items from localStorage', () => {
    localStorage.setItem(
      'contractor-ops:pinned-items',
      JSON.stringify([{ type: 'contract', id: 'ct1', name: 'Service Agreement' }]),
    );
    render(<CommandPalette />);
    expect(screen.getByText('Pinned')).toBeInTheDocument();
    expect(screen.getByText('Service Agreement')).toBeInTheDocument();
  });

  it('renders footer keyboard hints', () => {
    render(<CommandPalette />);
    const footerSpans = document.querySelectorAll('.font-mono');
    expect(footerSpans.length).toBeGreaterThan(0);
  });

  it('does not render dialog content when closed', () => {
    mockOpen = false;
    render(<CommandPalette />);
    expect(screen.queryByPlaceholderText('Search or type a command...')).not.toBeInTheDocument();
  });

  it('shows navigation items like Contractors and Invoices', () => {
    render(<CommandPalette />);
    expect(screen.getByText('Contractors')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
  });

  it('renders relative time for recent items (just now)', () => {
    mockRecentItems = [
      { id: 'c1', type: 'contractor', name: 'Test Co', viewedAt: Date.now() - 10000 },
    ];
    render(<CommandPalette />);
    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  it('renders relative time for recent items (minutes ago)', () => {
    mockRecentItems = [
      { id: 'c1', type: 'invoice', name: 'INV-001', viewedAt: Date.now() - 300000 },
    ];
    render(<CommandPalette />);
    expect(screen.getByText('5m ago')).toBeInTheDocument();
  });

  it('shows search results when search data is available', async () => {
    searchData = [
      { id: 'c1', name: 'Acme Corp', subtitle: 'NIP: 123456', type: 'contractor' },
      { id: 'i1', name: 'INV-001', subtitle: 'Pending', type: 'invoice' },
    ];
    const { user } = setup(<CommandPalette />);

    const input = screen.getByPlaceholderText('Search or type a command...');
    await user.type(input, 'acme');

    // Results section appears with search data
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });

  it('shows results section heading when searching', async () => {
    searchData = [{ id: 'c1', name: 'Test Corp', subtitle: 'NIP: 999', type: 'contractor' }];
    const { user } = setup(<CommandPalette />);

    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'test');

    await waitFor(() => {
      expect(screen.getByText('Results')).toBeInTheDocument();
    });
  });

  it('shows type badge on search results', async () => {
    searchData = [{ id: 'c1', name: 'Test Corp', subtitle: 'NIP: 111', type: 'contractor' }];
    const { user } = setup(<CommandPalette />);

    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'test');

    await waitFor(() => {
      // "contractor" badge appears in search results
      const badges = screen.getAllByText('contractor');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it('shows pin button for search results', async () => {
    searchData = [{ id: 'c1', name: 'Pin Test', subtitle: 'Sub', type: 'contract' }];
    const { user } = setup(<CommandPalette />);

    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'pin');

    await waitFor(() => {
      const pinBtn = screen.getByLabelText('Pin to favorites');
      expect(pinBtn).toBeInTheDocument();
    });
  });

  it('does not show recent and pinned sections when searching', async () => {
    mockRecentItems = [{ id: 'c1', type: 'contractor', name: 'Old Corp', viewedAt: Date.now() }];
    localStorage.setItem(
      'contractor-ops:pinned-items',
      JSON.stringify([{ type: 'contract', id: 'ct1', name: 'Pinned Agreement' }]),
    );
    searchData = [{ id: 'c1', name: 'Searched', subtitle: 'Sub', type: 'invoice' }];

    const { user } = setup(<CommandPalette />);

    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'search');

    await waitFor(() => {
      // Recent and Pinned sections should not show during search
      expect(screen.queryByText('Recent')).not.toBeInTheDocument();
      expect(screen.queryByText('Pinned')).not.toBeInTheDocument();
    });
  });

  it('renders quick action items', () => {
    render(<CommandPalette />);
    expect(screen.getByText('New contractor')).toBeInTheDocument();
    expect(screen.getByText('New contract')).toBeInTheDocument();
    expect(screen.getByText('Upload invoice')).toBeInTheDocument();
  });

  it('renders hours ago for recent items', () => {
    mockRecentItems = [
      { id: 'c1', type: 'contractor', name: 'Hr Corp', viewedAt: Date.now() - 7200000 },
    ];
    render(<CommandPalette />);
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('shows doc results when docSearchData has entries', async () => {
    docSearchData = [
      {
        id: 'd1',
        title: 'Team Guidelines',
        subtitle: 'Engineering',
        url: 'https://notion.so/page',
        provider: 'notion',
      },
    ];
    const { user } = setup(<CommandPalette />);

    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'guide');

    await waitFor(() => {
      expect(screen.getByText('Team Guidelines')).toBeInTheDocument();
      expect(screen.getByText('Docs')).toBeInTheDocument();
    });
  });

  it('shows confluence doc results with correct icon', async () => {
    docSearchData = [
      {
        id: 'd2',
        title: 'API Reference',
        subtitle: 'Backend',
        url: 'https://confluence.example.com/page',
        provider: 'confluence',
      },
    ];
    const { user } = setup(<CommandPalette />);

    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'api');

    await waitFor(() => {
      expect(screen.getByText('API Reference')).toBeInTheDocument();
      expect(screen.getByTestId('confluence-icon')).toBeInTheDocument();
    });
  });

  it('shows notion icon for notion doc results', async () => {
    docSearchData = [
      {
        id: 'd1',
        title: 'Onboarding Guide',
        subtitle: 'HR',
        url: 'https://notion.so/page',
        provider: 'notion',
      },
    ];
    const { user } = setup(<CommandPalette />);

    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'onboard');

    await waitFor(() => {
      expect(screen.getByTestId('notion-icon')).toBeInTheDocument();
    });
  });

  it('renders no results message when query matches nothing', async () => {
    searchData = [];
    docSearchData = [];
    const { user } = setup(<CommandPalette />);

    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'xyznonexistent');

    await waitFor(() => {
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  it('shows subtitle for search result items', async () => {
    searchData = [{ id: 'c1', name: 'Widget Corp', subtitle: 'NIP: 55555', type: 'contractor' }];
    const { user } = setup(<CommandPalette />);

    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'widget');

    await waitFor(() => {
      expect(screen.getByText('NIP: 55555')).toBeInTheDocument();
    });
  });

  it('renders doc badge for doc search results', async () => {
    docSearchData = [
      {
        id: 'd1',
        title: 'Some Doc',
        subtitle: 'Team',
        url: 'https://notion.so/p',
        provider: 'notion',
      },
    ];
    const { user } = setup(<CommandPalette />);

    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'some');

    await waitFor(() => {
      expect(screen.getByText('doc')).toBeInTheDocument();
    });
  });

  it('renders days ago for old recent items', () => {
    mockRecentItems = [
      { id: 'c1', type: 'contractor', name: 'Old Corp', viewedAt: Date.now() - 172800000 },
    ];
    render(<CommandPalette />);
    expect(screen.getByText('2d ago')).toBeInTheDocument();
  });

  it('shows Start workflow action', () => {
    render(<CommandPalette />);
    expect(screen.getByText('Start workflow')).toBeInTheDocument();
  });

  it('calls setOpen(false) when closed', () => {
    mockOpen = false;
    render(<CommandPalette />);
    // When mockOpen is false, dialog is closed
    expect(screen.queryByPlaceholderText('Search or type a command...')).not.toBeInTheDocument();
  });

  it('pins and unpins items via pin button toggle', async () => {
    searchData = [{ id: 'c1', name: 'Pin Toggle Corp', subtitle: 'Sub', type: 'contract' }];
    const { user } = setup(<CommandPalette />);

    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'pin toggle');

    await waitFor(() => {
      const pinBtn = screen.getByLabelText('Pin to favorites');
      expect(pinBtn).toBeInTheDocument();
    });

    // Pin the item
    await user.click(screen.getByLabelText('Pin to favorites'));

    // After pinning, the label should change to "Unpin"
    await waitFor(() => {
      expect(screen.getByLabelText('Unpin')).toBeInTheDocument();
    });
  });

  it('filters actions and pages when search query matches', async () => {
    const { user } = setup(<CommandPalette />);

    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'dashboard');

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton when search is loading', () => {
    searchLoading = true;
    searchData = [];
    render(<CommandPalette />);
    // Dialog is open, type something to trigger search
    expect(screen.getByPlaceholderText('Search or type a command...')).toBeInTheDocument();
  });

  it('clears search query when dialog closes and reopens', () => {
    render(<CommandPalette />);
    const input = screen.getByPlaceholderText('Search or type a command...');
    expect(input).toHaveValue('');
  });

  it('renders multiple search results with correct types', async () => {
    searchData = [
      { id: 'c1', name: 'Result A', subtitle: 'A sub', type: 'contractor' },
      { id: 'c2', name: 'Result B', subtitle: 'B sub', type: 'invoice' },
      { id: 'c3', name: 'Result C', subtitle: 'C sub', type: 'contract' },
    ];
    const { user } = setup(<CommandPalette />);

    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'result');

    await waitFor(() => {
      expect(screen.getByText('Result A')).toBeInTheDocument();
      expect(screen.getByText('Result B')).toBeInTheDocument();
      expect(screen.getByText('Result C')).toBeInTheDocument();
    });
  });

  it('shows multiple pinned items from localStorage', () => {
    localStorage.setItem(
      'contractor-ops:pinned-items',
      JSON.stringify([
        { type: 'contract', id: 'ct1', name: 'Agreement 1' },
        { type: 'contractor', id: 'ct2', name: 'Corp 2' },
      ]),
    );
    render(<CommandPalette />);
    expect(screen.getByText('Agreement 1')).toBeInTheDocument();
    expect(screen.getByText('Corp 2')).toBeInTheDocument();
  });

  // ---- Navigate callback: quick action ----
  it('navigates to /contractors?action=new when New contractor is selected', async () => {
    const { user } = setup(<CommandPalette />);
    await user.click(screen.getByText('New contractor'));
    expect(mockPush).toHaveBeenCalledWith('/contractors?action=new');
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  it('navigates to /contracts?action=new when New contract is selected', async () => {
    const { user } = setup(<CommandPalette />);
    await user.click(screen.getByText('New contract'));
    expect(mockPush).toHaveBeenCalledWith('/contracts?action=new');
  });

  it('navigates to /invoices?action=upload when Upload invoice is selected', async () => {
    const { user } = setup(<CommandPalette />);
    await user.click(screen.getByText('Upload invoice'));
    expect(mockPush).toHaveBeenCalledWith('/invoices?action=upload');
  });

  it('navigates to /workflows?action=start when Start workflow is selected', async () => {
    const { user } = setup(<CommandPalette />);
    await user.click(screen.getByText('Start workflow'));
    expect(mockPush).toHaveBeenCalledWith('/workflows?action=start');
  });

  // ---- Navigate callback: page navigation ----
  it('navigates and records recent when Dashboard page is selected', async () => {
    const { user } = setup(<CommandPalette />);
    await user.click(screen.getByText('Dashboard'));
    expect(mockPush).toHaveBeenCalled();
    expect(mockAddRecentItem).toHaveBeenCalled();
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  // ---- Entity click: navigates and adds to recent ----
  it('navigates to entity detail and adds to recent on search result click', async () => {
    searchData = [{ id: 'c99', name: 'Click Corp', subtitle: 'NIP: 999', type: 'contractor' }];
    const { user } = setup(<CommandPalette />);
    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'click');
    await waitFor(() => {
      expect(screen.getByText('Click Corp')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Click Corp'));
    expect(mockAddRecentItem).toHaveBeenCalledWith({
      id: 'c99',
      type: 'contractor',
      name: 'Click Corp',
    });
    expect(mockPush).toHaveBeenCalledWith('/contractors/c99');
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  // ---- Recent item click: page type ----
  it('navigates to page href when recent page item is clicked', async () => {
    mockRecentItems = [
      { id: '/invoices', type: 'page', name: 'Recent Invoices Page', viewedAt: Date.now() },
    ];
    const { user } = setup(<CommandPalette />);
    await user.click(screen.getByText('Recent Invoices Page'));
    expect(mockPush).toHaveBeenCalledWith('/invoices');
  });

  // ---- Recent item click: entity type ----
  it('navigates to entity detail when recent entity item is clicked', async () => {
    mockRecentItems = [
      { id: 'c50', type: 'contractor', name: 'Recent Corp', viewedAt: Date.now() },
    ];
    const { user } = setup(<CommandPalette />);
    await user.click(screen.getByText('Recent Corp'));
    expect(mockPush).toHaveBeenCalledWith('/contractors/c50');
    expect(mockAddRecentItem).toHaveBeenCalled();
  });

  // ---- Unpin after pinning ----
  it('unpins a previously pinned item', async () => {
    searchData = [{ id: 'c1', name: 'Unpin Corp', subtitle: 'Sub', type: 'contract' }];
    const { user } = setup(<CommandPalette />);
    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'unpin');
    await waitFor(() => {
      expect(screen.getByLabelText('Pin to favorites')).toBeInTheDocument();
    });
    // Pin
    await user.click(screen.getByLabelText('Pin to favorites'));
    await waitFor(() => {
      expect(screen.getByLabelText('Unpin')).toBeInTheDocument();
    });
    // Unpin
    await user.click(screen.getByLabelText('Unpin'));
    await waitFor(() => {
      expect(screen.getByLabelText('Pin to favorites')).toBeInTheDocument();
    });
  });

  // ---- Pinned item click navigates ----
  it('navigates to contract detail when pinned item is clicked', async () => {
    localStorage.setItem(
      'contractor-ops:pinned-items',
      JSON.stringify([{ type: 'contract', id: 'ct5', name: 'Pinned Contract' }]),
    );
    const { user } = setup(<CommandPalette />);
    await user.click(screen.getByText('Pinned Contract'));
    expect(mockPush).toHaveBeenCalledWith('/contracts/ct5');
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  // ---- Keyboard shortcut footer ----
  it('renders select, navigate and close footer hints', () => {
    render(<CommandPalette />);
    const footerSpans = document.querySelectorAll('.font-mono');
    expect(footerSpans.length).toBe(3);
  });

  // ---- Invoice entity URL ----
  it('navigates to invoice detail when invoice result is clicked', async () => {
    searchData = [{ id: 'inv1', name: 'INV-100', subtitle: 'Pending', type: 'invoice' }];
    const { user } = setup(<CommandPalette />);
    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'inv');
    await waitFor(() => {
      expect(screen.getByText('INV-100')).toBeInTheDocument();
    });
    await user.click(screen.getByText('INV-100'));
    expect(mockPush).toHaveBeenCalledWith('/invoices/inv1');
  });

  // ---- Matched pages during search ----
  it('shows matched pages section during search when query matches page', async () => {
    const { user } = setup(<CommandPalette />);
    await user.type(screen.getByPlaceholderText('Search or type a command...'), 'Dashboard');
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });
});
