/**
 * The presentational `PortalPendingSignatures` accepts
 * the `usePortalPendingSignaturesView` return as a `view` prop. The
 * embedded signing modal container is stubbed because it hits tRPC for
 * envelope details.
 */

vi.mock('../embedded-signing-modal-container', () => ({
  EmbeddedSigningModalContainer: () => null,
}));

vi.mock('@/lib/format/use-portal-date-formatter.js', () => ({
  usePortalDateFormatter: () => ({
    formatDate: (v: unknown) =>
      v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''),
  }),
}));

import { render, screen, setup } from '@/test/test-utils';
import type {
  PendingSignatureItem,
  usePortalPendingSignaturesView,
} from '../hooks/use-portal-pending-signatures-view.js';
import { PendingSignaturesSkeleton, PortalPendingSignatures } from '../portal-pending-signatures';

type View = ReturnType<typeof usePortalPendingSignaturesView>;

const items: PendingSignatureItem[] = [
  {
    envelopeId: 'env-1',
    contractId: 'ct-abc123',
    recipientName: 'Jane Doe',
    recipientEmail: 'jane@example.com',
    recipientStatus: 'SENT',
    envelopeStatus: 'SENT',
    message: null,
    expiresAt: null,
    sentAt: new Date('2025-04-01T00:00:00Z'),
  },
];

function makeView(overrides: Partial<View> = {}): View {
  return {
    pendingQuery: { isPending: false, isError: false } as unknown as View['pendingQuery'],
    items,
    signingTarget: null,
    handleSign: vi.fn(),
    clearSigningTarget: vi.fn(),
    handleSigningComplete: vi.fn(),
    ...overrides,
  } as View;
}

describe('PortalPendingSignatures', () => {
  it('renders the title and item count badge when items are present', () => {
    render(<PortalPendingSignatures view={makeView()} />);
    expect(screen.getByText(/pendingSignatures\.title|Pending|signatures/i)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders the contract id suffix in the card title', () => {
    render(<PortalPendingSignatures view={makeView()} />);
    // contractId 'ct-abc123' → last 6 chars: 'abc123'
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it('renders a Sign-now button per item', () => {
    render(<PortalPendingSignatures view={makeView()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('invokes view.handleSign with the item when Sign-now is clicked', async () => {
    const handleSign = vi.fn();
    const { user } = setup(<PortalPendingSignatures view={makeView({ handleSign })} />);
    await user.click(screen.getByRole('button'));
    expect(handleSign).toHaveBeenCalledWith(items[0]);
  });

  it('renders skeleton cards from PendingSignaturesSkeleton', () => {
    const { container } = render(<PendingSignaturesSkeleton />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });
});
