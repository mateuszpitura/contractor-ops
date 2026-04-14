import { render, screen } from '@/test/test-utils';
import { PortalPendingSignatures } from '../portal-pending-signatures';

vi.mock('@/trpc/init', () => ({
  trpc: {
    esign: {
      listPendingForContractor: {
        queryOptions: () => ({ queryKey: ['esign.pending'] }),
      },
    },
  },
}));

vi.mock('@/components/contracts/contract-detail/embedded-signing-modal', () => ({
  EmbeddedSigningModal: () => null,
}));

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: mockUseQuery,
  };
});
describe('PortalPendingSignatures', () => {
  it('returns null when no pending items', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isPending: false,
      refetch: vi.fn(),
    });

    const { container } = render(<PortalPendingSignatures />);

    expect(container.innerHTML).toBe('');
  });

  it('renders heading and sign now button when items exist', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          envelopeId: 'env-1',
          contractId: 'contract-abcdef',
          recipientName: 'Jan',
          recipientEmail: 'jan@test.com',
          recipientStatus: 'PENDING',
          envelopeStatus: 'SENT',
          message: null,
          expiresAt: null,
          sentAt: new Date().toISOString(),
        },
      ],
      isPending: false,
      refetch: vi.fn(),
    });

    render(<PortalPendingSignatures />);

    expect(screen.getByText(/pending signatures/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign now/i })).toBeInTheDocument();
  });

  it('renders loading skeletons when query is pending', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      refetch: vi.fn(),
    });

    const { container } = render(<PortalPendingSignatures />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it('renders item count badge when items exist', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          envelopeId: 'env-1',
          contractId: 'contract-abc',
          recipientName: 'Jan',
          recipientEmail: 'jan@test.com',
          recipientStatus: 'PENDING',
          envelopeStatus: 'SENT',
          message: null,
          expiresAt: null,
          sentAt: new Date().toISOString(),
        },
      ],
      isPending: false,
      refetch: vi.fn(),
    });

    render(<PortalPendingSignatures />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders contract ID suffix in card', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          envelopeId: 'env-2',
          contractId: 'contract-abcdef',
          recipientName: 'Jan',
          recipientEmail: 'jan@test.com',
          recipientStatus: 'PENDING',
          envelopeStatus: 'SENT',
          message: null,
          expiresAt: null,
          sentAt: new Date().toISOString(),
        },
      ],
      isPending: false,
      refetch: vi.fn(),
    });

    render(<PortalPendingSignatures />);
    // contractId.slice(-6) = "abcdef"
    expect(screen.getByText(/abcdef/)).toBeInTheDocument();
  });

  it('renders "view all" link when more than 5 items', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      envelopeId: `env-${i}`,
      contractId: `contract-${i}`,
      recipientName: 'Jan',
      recipientEmail: 'jan@test.com',
      recipientStatus: 'PENDING',
      envelopeStatus: 'SENT',
      message: null,
      expiresAt: null,
      sentAt: new Date().toISOString(),
    }));

    mockUseQuery.mockReturnValue({
      data: items,
      isPending: false,
      refetch: vi.fn(),
    });

    render(<PortalPendingSignatures />);
    expect(screen.getByText(/view all/i)).toBeInTheDocument();
    // Only 5 sign now buttons rendered (max 5 displayed)
    expect(screen.getAllByRole('button', { name: /sign now/i })).toHaveLength(5);
  });
});
