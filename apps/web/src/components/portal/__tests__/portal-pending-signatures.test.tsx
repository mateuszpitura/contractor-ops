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

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

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
});
