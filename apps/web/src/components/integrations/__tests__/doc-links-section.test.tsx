import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { DocLinksSection } from '../doc-links-section';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../doc-link-chip', () => ({
  DocLinkChip: ({
    title,
    provider,
    id,
  }: {
    id: string;
    title: string;
    url: string;
    provider: string;
    lastEditedTime?: string;
    readOnly?: boolean;
    onRemove?: (id: string) => void;
  }) => (
    <span data-testid={`doc-chip-${id}`}>
      {title} ({provider})
    </span>
  ),
}));

vi.mock('../attach-doc-dialog', () => ({
  AttachDocDialog: ({
    open,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    workflowTaskRunId: string;
  }) => (open ? <div data-testid="attach-dialog">AttachDocDialog</div> : null),
}));

const mockDocLinks = [
  {
    id: 'dl-1',
    externalUrl: 'https://notion.so/page1',
    externalType: 'NOTION_PAGE',
    metadataJson: { title: 'Onboarding Guide', lastEditedTime: new Date().toISOString() },
  },
  {
    id: 'dl-2',
    externalUrl: 'https://confluence.com/page2',
    externalType: 'CONFLUENCE_PAGE',
    metadataJson: { title: 'API Reference' },
  },
];

let listData: unknown[] = [];
let listLoading = false;

const mockMutate = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({
      isLoading: listLoading,
      data: listData,
    }),
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
      list: {
        queryOptions: vi.fn(() => ({ queryKey: ['docs', 'list'] })),
        queryKey: vi.fn(() => ['docs', 'list']),
      },
      detach: { mutationOptions: vi.fn(() => ({})) },
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocLinksSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listData = [];
    listLoading = false;
  });

  it('renders Documents header', () => {
    render(<DocLinksSection workflowTaskRunId="wtr-1" />);
    expect(screen.getByText('Documents')).toBeInTheDocument();
  });

  it('renders Attach Document button when not readOnly', () => {
    render(<DocLinksSection workflowTaskRunId="wtr-1" />);
    expect(screen.getByRole('button', { name: 'Attach Document' })).toBeInTheDocument();
  });

  it('does not render Attach Document button in readOnly mode', () => {
    render(<DocLinksSection workflowTaskRunId="wtr-1" readOnly={true} />);
    expect(screen.queryByRole('button', { name: 'Attach Document' })).not.toBeInTheDocument();
  });

  it('shows empty state when no docs attached', () => {
    render(<DocLinksSection workflowTaskRunId="wtr-1" />);
    expect(screen.getByText('No documents attached.')).toBeInTheDocument();
  });

  it('renders doc link chips when data available', () => {
    listData = mockDocLinks;
    render(<DocLinksSection workflowTaskRunId="wtr-1" />);
    expect(screen.getByTestId('doc-chip-dl-1')).toBeInTheDocument();
    expect(screen.getByTestId('doc-chip-dl-2')).toBeInTheDocument();
  });

  it('renders doc titles', () => {
    listData = mockDocLinks;
    render(<DocLinksSection workflowTaskRunId="wtr-1" />);
    expect(screen.getByText(/Onboarding Guide/)).toBeInTheDocument();
    expect(screen.getByText(/API Reference/)).toBeInTheDocument();
  });

  it('opens attach dialog when button clicked', async () => {
    const { user } = setup(<DocLinksSection workflowTaskRunId="wtr-1" />);
    await user.click(screen.getByText('Attach Document'));
    expect(screen.getByTestId('attach-dialog')).toBeInTheDocument();
  });

  it('does not show empty message when docs exist', () => {
    listData = mockDocLinks;
    render(<DocLinksSection workflowTaskRunId="wtr-1" />);
    expect(screen.queryByText('No documents attached.')).not.toBeInTheDocument();
  });
});
