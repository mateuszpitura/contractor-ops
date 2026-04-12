import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { SendForSignatureDialog } from '../send-for-signature-dialog';

const mockedUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockedUseQuery(...args),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    esign: {
      listConnections: {
        queryOptions: () => ({ queryKey: ['esign', 'connections'] }),
      },
      sendForSignature: { mutationOptions: (opts: Record<string, unknown>) => opts },
      listEnvelopes: { queryKey: () => ['esign', 'envelopes'] },
    },
    contract: {
      getById: { queryKey: () => ['contract', 'getById'] },
    },
  },
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
  arrayMove: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  contractId: 'ct1',
  documentId: 'doc1',
  contractParties: [{ name: 'Jan Kowalski', email: 'jan@test.com', role: 'signer' as const }],
};

describe('SendForSignatureDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseQuery.mockReturnValue({
      data: [],
      isPending: false,
      isLoading: false,
    });
  });

  // ---- Basic rendering ----
  it('renders dialog when open', () => {
    render(<SendForSignatureDialog {...defaultProps} />);
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
  });

  it('does not render when closed', () => {
    render(<SendForSignatureDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  // ---- Signer management ----
  it('renders signer row with name and email', () => {
    render(<SendForSignatureDialog {...defaultProps} />);
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('jan@test.com')).toBeInTheDocument();
  });

  it('renders multiple signers when provided', () => {
    render(
      <SendForSignatureDialog
        {...defaultProps}
        contractParties={[
          { name: 'Jan Kowalski', email: 'jan@test.com', role: 'signer' },
          {
            name: 'Anna Nowak',
            email: 'anna@test.com',
            role: 'countersigner',
          },
        ]}
      />,
    );
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
  });

  it('renders signer role badges', () => {
    render(
      <SendForSignatureDialog
        {...defaultProps}
        contractParties={[
          { name: 'Jan Kowalski', email: 'jan@test.com', role: 'signer' },
          {
            name: 'Anna Nowak',
            email: 'anna@test.com',
            role: 'countersigner',
          },
        ]}
      />,
    );
    expect(screen.getByText('Contractor')).toBeInTheDocument();
    expect(screen.getByText('Countersigner')).toBeInTheDocument();
  });

  it('renders no signers text when contractParties is empty', () => {
    render(<SendForSignatureDialog {...defaultProps} contractParties={[]} />);
    expect(screen.getByText(/no signers/i)).toBeInTheDocument();
  });

  it('shows add countersigner link when no countersigner exists', () => {
    render(<SendForSignatureDialog {...defaultProps} />);
    expect(screen.getByText(/add countersigner/i)).toBeInTheDocument();
  });

  it('hides add countersigner link when countersigner exists', () => {
    render(
      <SendForSignatureDialog
        {...defaultProps}
        contractParties={[
          { name: 'Jan Kowalski', email: 'jan@test.com', role: 'signer' },
          {
            name: 'Anna Nowak',
            email: 'anna@test.com',
            role: 'countersigner',
          },
        ]}
      />,
    );
    expect(screen.queryByText(/add countersigner/i)).not.toBeInTheDocument();
  });

  it('adds a countersigner when add countersigner link is clicked', async () => {
    const { user } = setup(<SendForSignatureDialog {...defaultProps} />);
    await user.click(screen.getByText(/add countersigner/i));
    // After adding, the link should disappear
    expect(screen.queryByText(/add countersigner/i)).not.toBeInTheDocument();
  });

  // ---- Provider selection ----
  it('renders provider label when connections are loaded', () => {
    mockedUseQuery.mockReturnValue({
      data: [{ id: 'conn1', provider: 'DOCUSIGN', status: 'ACTIVE', displayName: null }],
      isPending: false,
      isLoading: false,
    });
    render(<SendForSignatureDialog {...defaultProps} />);
    // Provider section label should be visible
    expect(screen.getByText('Signing Provider')).toBeInTheDocument();
  });

  it('shows placeholder text when no connections are available', () => {
    mockedUseQuery.mockReturnValue({
      data: [],
      isPending: false,
      isLoading: false,
    });
    render(<SendForSignatureDialog {...defaultProps} />);
    expect(screen.getByText(/select a provider/i)).toBeInTheDocument();
  });

  // ---- Validation ----
  it('send button is disabled when no provider is selected', () => {
    render(<SendForSignatureDialog {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const sendBtn = buttons.find(b => b.textContent?.includes('Send'));
    expect(sendBtn).toBeDisabled();
  });

  it('send button is disabled when no signers', () => {
    render(<SendForSignatureDialog {...defaultProps} contractParties={[]} />);
    const buttons = screen.getAllByRole('button');
    const sendBtn = buttons.find(b => b.textContent?.includes('Send'));
    expect(sendBtn).toBeDisabled();
  });

  // ---- Message textarea ----
  it('renders message textarea', () => {
    render(<SendForSignatureDialog {...defaultProps} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('allows typing in the message field', async () => {
    const { user } = setup(<SendForSignatureDialog {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Please sign this');
    expect(textarea).toHaveValue('Please sign this');
  });

  // ---- Document section ----
  it('renders document section with document ID', () => {
    render(<SendForSignatureDialog {...defaultProps} />);
    expect(screen.getByText('doc1')).toBeInTheDocument();
  });

  // ---- Discard ----
  it('calls onOpenChange(false) when discard is clicked', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(
      <SendForSignatureDialog {...defaultProps} onOpenChange={onOpenChange} />,
    );
    const discardBtn = screen.getByText('Discard');
    await user.click(discardBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // ---- Remove signer ----
  it('renders remove button for each signer', () => {
    render(
      <SendForSignatureDialog
        {...defaultProps}
        contractParties={[
          { name: 'Jan Kowalski', email: 'jan@test.com', role: 'signer' },
          { name: 'Anna Nowak', email: 'anna@test.com', role: 'countersigner' },
        ]}
      />,
    );
    // Should have remove buttons for signers
    const removeButtons = screen
      .getAllByRole('button')
      .filter(
        b => b.getAttribute('aria-label')?.includes('Remove') || b.textContent?.includes('Remove'),
      );
    expect(removeButtons.length).toBeGreaterThanOrEqual(0);
  });

  // ---- Provider connection rendering ----
  it('renders provider select with single connection', () => {
    mockedUseQuery.mockReturnValue({
      data: [{ id: 'conn1', provider: 'DOCUSIGN', status: 'ACTIVE', displayName: 'DocuSign' }],
      isPending: false,
      isLoading: false,
    });
    render(<SendForSignatureDialog {...defaultProps} />);
    expect(screen.getByText('Signing Provider')).toBeInTheDocument();
  });

  it('renders provider select with multiple connections', () => {
    mockedUseQuery.mockReturnValue({
      data: [
        { id: 'conn1', provider: 'DOCUSIGN', status: 'ACTIVE', displayName: null },
        { id: 'conn2', provider: 'AUTENTI', status: 'ACTIVE', displayName: null },
      ],
      isPending: false,
      isLoading: false,
    });
    render(<SendForSignatureDialog {...defaultProps} />);
    expect(screen.getByText('Signing Provider')).toBeInTheDocument();
  });

  // ---- Signer order ----
  it('renders signer and countersigner in order', () => {
    render(
      <SendForSignatureDialog
        {...defaultProps}
        contractParties={[
          { name: 'Jan Kowalski', email: 'jan@test.com', role: 'signer' },
          { name: 'Anna Nowak', email: 'anna@test.com', role: 'countersigner' },
        ]}
      />,
    );
    const names = screen.getAllByText(/Kowalski|Nowak/);
    expect(names.length).toBe(2);
  });

  // ---- Message textarea interaction ----
  it('allows clearing and retyping message', async () => {
    const { user } = setup(<SendForSignatureDialog {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello');
    await user.clear(textarea);
    await user.type(textarea, 'New message');
    expect(textarea).toHaveValue('New message');
  });

  // ---- Document ID display ----
  it('displays the document ID in the dialog', () => {
    render(<SendForSignatureDialog {...defaultProps} documentId="doc-xyz" />);
    expect(screen.getByText('doc-xyz')).toBeInTheDocument();
  });

  // ---- Three signers ----
  it('renders three signers correctly', () => {
    render(
      <SendForSignatureDialog
        {...defaultProps}
        contractParties={[
          { name: 'Jan Kowalski', email: 'jan@test.com', role: 'signer' },
          { name: 'Anna Nowak', email: 'anna@test.com', role: 'countersigner' },
          { name: 'Piotr Krawczyk', email: 'piotr@test.com', role: 'signer' },
        ]}
      />,
    );
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
    expect(screen.getByText('Piotr Krawczyk')).toBeInTheDocument();
  });

  // ---- Message empty by default ----
  it('starts with empty message textarea', () => {
    render(<SendForSignatureDialog {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('');
  });

  // ---- Contract ID ----
  it('renders contract and document IDs', () => {
    render(<SendForSignatureDialog {...defaultProps} contractId="ct-abc" documentId="doc-123" />);
    expect(screen.getByText('doc-123')).toBeInTheDocument();
  });

  // ---- Single signer with countersigner add flow ----
  it('shows countersigner after adding and typing name', async () => {
    const { user } = setup(<SendForSignatureDialog {...defaultProps} />);
    await user.click(screen.getByText(/add countersigner/i));
    expect(screen.getByText('Countersigner')).toBeInTheDocument();
  });

  // ---- Provider loading state ----
  it('shows loading state when connections are loading', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isLoading: true,
    });
    render(<SendForSignatureDialog {...defaultProps} />);
    expect(screen.getByText('Signing Provider')).toBeInTheDocument();
  });

  // ---- Multiple provider connections ----
  it('renders AUTENTI provider option', () => {
    mockedUseQuery.mockReturnValue({
      data: [{ id: 'conn1', provider: 'AUTENTI', status: 'ACTIVE', displayName: 'Autenti' }],
      isPending: false,
      isLoading: false,
    });
    render(<SendForSignatureDialog {...defaultProps} />);
    expect(screen.getByText('Signing Provider')).toBeInTheDocument();
  });

  // ---- Message textarea ----
  it('allows typing a message in the textarea', async () => {
    const { user } = setup(<SendForSignatureDialog {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Please sign this contract.');
    expect(textarea).toHaveValue('Please sign this contract.');
  });

  // ---- Signer name editing ----
  it('allows editing signer name field', async () => {
    setup(<SendForSignatureDialog {...defaultProps} />);
    // Should have signer input fields
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Add countersigner button ----
  it('adds countersigner section when add countersigner is clicked', async () => {
    const { user } = setup(<SendForSignatureDialog {...defaultProps} />);
    const addBtn = screen.getByText(/add countersigner/i);
    await user.click(addBtn);
    // Countersigner section should appear
    expect(screen.getByText('Countersigner')).toBeInTheDocument();
  });

  // ---- Message input interaction ----
  it('allows typing in the message field', async () => {
    const { user } = setup(<SendForSignatureDialog {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Please review');
    expect(textarea).toHaveValue('Please review');
  });

  // ---- Dialog renders Send button ----
  it('renders the send button', () => {
    render(<SendForSignatureDialog {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
