import { useQuery } from '@tanstack/react-query';
import { render, screen, setup } from '@/test/test-utils';
import { TaskAttachments } from '../task-attachments';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...actual, useQuery: vi.fn() };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    document: {
      list: { queryOptions: () => ({ queryKey: ['document', 'list'] }) },
    },
  },
}));

vi.mock('@/components/documents/drop-zone', () => ({
  DropZone: () => <div data-testid="drop-zone">DropZone</div>,
}));

vi.mock('@/components/documents/document-card', () => ({
  DocumentCard: ({ document }: { document: { name: string } }) => (
    <div data-testid="document-card">{document.name}</div>
  ),
}));

const mockedUseQuery = vi.mocked(useQuery);

describe('TaskAttachments', () => {
  it('renders heading and add button', () => {
    mockedUseQuery.mockReturnValue({ data: { items: [] }, isLoading: false } as unknown);
    render(<TaskAttachments runId="run-1" taskRunId="task-1" />);
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText('Add attachment')).toBeInTheDocument();
  });

  it('shows no attachments message when empty', () => {
    mockedUseQuery.mockReturnValue({ data: { items: [] }, isLoading: false } as unknown);
    render(<TaskAttachments runId="run-1" taskRunId="task-1" />);
    expect(screen.getByText('No attachments.')).toBeInTheDocument();
  });

  it('renders document cards when documents exist', () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [{ id: 'd1', name: 'file.pdf' }] },
      isLoading: false,
    } as unknown);
    render(<TaskAttachments runId="run-1" taskRunId="task-1" />);
    expect(screen.getByText('file.pdf')).toBeInTheDocument();
  });

  it('toggles drop zone on add button click', async () => {
    mockedUseQuery.mockReturnValue({ data: { items: [] }, isLoading: false } as unknown);
    const { user } = setup(<TaskAttachments runId="run-1" taskRunId="task-1" />);
    await user.click(screen.getByText('Add attachment'));
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
  });
});
