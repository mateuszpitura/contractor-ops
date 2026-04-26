import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup, waitFor } from '@/test/test-utils';
import { AttachDocDialog } from '../attach-doc-dialog';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../provider-icons', () => ({
  NotionIcon: ({ className }: { className?: string }) => (
    <span data-testid="notion-icon" className={className} />
  ),
  ConfluenceIcon: ({ className }: { className?: string }) => (
    <span data-testid="confluence-icon" className={className} />
  ),
}));

const mockSearchResults = [
  {
    id: 'page-1',
    title: 'Design System',
    icon: null,
    subtitle: 'Engineering',
    url: 'https://notion.so/page-1',
    provider: 'notion',
  },
  {
    id: 'page-2',
    title: 'API Docs',
    icon: null,
    subtitle: 'Docs Space',
    url: 'https://confluence.com/page-2',
    provider: 'confluence',
  },
];

let searchData: unknown[] = [];
let searchLoading = false;

const { mockMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (opts: { queryKey?: unknown; enabled?: boolean }) => {
      const key = JSON.stringify(opts.queryKey ?? '');
      if (key.includes('search')) {
        return { isLoading: searchLoading, data: searchData };
      }
      return { isLoading: false, data: null };
    },
    useMutation: (opts: Record<string, unknown>) => ({
      mutate: mockMutate,
      isPending: false,
      ...opts,
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    docs: {
      search: {
        queryOptions: vi.fn(() => ({ queryKey: ['docs', 'search'] })),
      },
      attach: { mutationOptions: vi.fn(() => ({})) },
      list: {
        queryKey: vi.fn(() => ['docs', 'list']),
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AttachDocDialog', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    searchData = [];
    searchLoading = false;
  });

  it('renders dialog title when open', () => {
    render(<AttachDocDialog workflowTaskRunId="wtr-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Attach Document')).toBeInTheDocument();
  });

  it('renders dialog description', () => {
    render(<AttachDocDialog workflowTaskRunId="wtr-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Search for a page to link to this step.')).toBeInTheDocument();
  });

  it('does not render dialog when closed', () => {
    render(<AttachDocDialog workflowTaskRunId="wtr-1" open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByText('Attach Document')).not.toBeInTheDocument();
  });

  it('renders search input with placeholder', () => {
    render(<AttachDocDialog workflowTaskRunId="wtr-1" open={true} onOpenChange={onOpenChange} />);
    expect(
      screen.getByPlaceholderText('Search Notion and Confluence pages...'),
    ).toBeInTheDocument();
  });

  it('renders provider filter buttons', () => {
    render(<AttachDocDialog workflowTaskRunId="wtr-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Notion')).toBeInTheDocument();
    expect(screen.getByText('Confluence')).toBeInTheDocument();
  });

  it('shows no results message when search returns empty', async () => {
    searchData = [];
    const { user } = setup(
      <AttachDocDialog workflowTaskRunId="wtr-1" open={true} onOpenChange={onOpenChange} />,
    );
    const input = screen.getByPlaceholderText('Search Notion and Confluence pages...');
    await user.type(input, 'xyz');
    await waitFor(() => {
      expect(screen.getByText('No pages found matching your search.')).toBeInTheDocument();
    });
  });

  it('renders search results when available', async () => {
    searchData = mockSearchResults;
    const { user } = setup(
      <AttachDocDialog workflowTaskRunId="wtr-1" open={true} onOpenChange={onOpenChange} />,
    );
    const input = screen.getByPlaceholderText('Search Notion and Confluence pages...');
    await user.type(input, 'design');
    await waitFor(() => {
      expect(screen.getByText('Design System')).toBeInTheDocument();
      expect(screen.getByText('API Docs')).toBeInTheDocument();
    });
  });

  it('renders result subtitles', async () => {
    searchData = mockSearchResults;
    const { user } = setup(
      <AttachDocDialog workflowTaskRunId="wtr-1" open={true} onOpenChange={onOpenChange} />,
    );
    const input = screen.getByPlaceholderText('Search Notion and Confluence pages...');
    await user.type(input, 'docs');
    await waitFor(() => {
      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.getByText('Docs Space')).toBeInTheDocument();
    });
  });

  it('calls mutate when selecting a result', async () => {
    searchData = mockSearchResults;
    const { user } = setup(
      <AttachDocDialog workflowTaskRunId="wtr-1" open={true} onOpenChange={onOpenChange} />,
    );
    const input = screen.getByPlaceholderText('Search Notion and Confluence pages...');
    await user.type(input, 'design');
    await waitFor(() => {
      expect(screen.getByText('Design System')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Design System'));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowTaskRunId: 'wtr-1',
        externalId: 'page-1',
        externalUrl: 'https://notion.so/page-1',
        externalType: 'NOTION_PAGE',
      }),
    );
  });
});
