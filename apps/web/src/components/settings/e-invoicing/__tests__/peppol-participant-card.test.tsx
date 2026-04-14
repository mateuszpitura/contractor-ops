import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';

import {
  PeppolParticipantStatusPill,
  semanticTriadClass,
  type PeppolParticipantStatus,
} from '../peppol-participant-status-pill';
import { PeppolParticipantCard } from '../peppol-participant-card';

// ---------------------------------------------------------------------------
// Mocks — tRPC client + TanStack React Query
// ---------------------------------------------------------------------------

let participantsData: unknown = [];
let participantsLoading = false;

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({ data: participantsData, isLoading: participantsLoading }),
    useMutation: () => ({
      mutate: vi.fn(),
      isPending: false,
    }),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    peppol: {
      listParticipants: {
        queryOptions: vi.fn(() => ({ queryKey: ['peppol', 'listParticipants'] })),
        queryKey: vi.fn(() => ['peppol', 'listParticipants']),
      },
      getStatus: {
        queryOptions: vi.fn(() => ({ queryKey: ['peppol', 'getStatus'] })),
        queryKey: vi.fn(() => ['peppol', 'getStatus']),
      },
      connect: {
        mutationOptions: vi.fn(() => ({ mutationKey: ['peppol', 'connect'] })),
      },
      disconnect: {
        mutationOptions: vi.fn(() => ({ mutationKey: ['peppol', 'disconnect'] })),
      },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Status-pill tests (pure stateless semantic-triad assertions)
// ---------------------------------------------------------------------------

describe('PeppolParticipantStatusPill — semantic triad', () => {
  const statuses: readonly PeppolParticipantStatus[] = [
    'ACTIVE',
    'REGISTERED',
    'PENDING',
    'SUSPENDED',
    'DEREGISTERED',
    'NOT_REGISTERED',
  ] as const;

  it.each(statuses)(
    'combines icon + visible text label for status=%s (WCAG 1.4.1)',
    status => {
      render(<PeppolParticipantStatusPill status={status} label={status} />);
      // Visible text label present
      expect(screen.getByText(status)).toBeInTheDocument();
    },
  );

  it('maps ACTIVE / REGISTERED to border-success class', () => {
    expect(semanticTriadClass('ACTIVE')).toContain('border-success');
    expect(semanticTriadClass('REGISTERED')).toContain('border-success');
  });

  it('maps PENDING / SUSPENDED to border-warning class', () => {
    expect(semanticTriadClass('PENDING')).toContain('border-warning');
    expect(semanticTriadClass('SUSPENDED')).toContain('border-warning');
  });

  it('maps DEREGISTERED to border-destructive class', () => {
    expect(semanticTriadClass('DEREGISTERED')).toContain('border-destructive');
  });

  it('maps NOT_REGISTERED to border-muted class', () => {
    expect(semanticTriadClass('NOT_REGISTERED')).toContain('border-muted');
  });

  it('renders icon as aria-hidden (colour never alone conveys meaning)', () => {
    const { container } = render(
      <PeppolParticipantStatusPill status="ACTIVE" label="Active" />,
    );
    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Card tests — no / active participant states
// ---------------------------------------------------------------------------

describe('PeppolParticipantCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    participantsData = [];
    participantsLoading = false;
  });

  it('renders empty state + "Register Peppol participant" CTA when no participant', () => {
    participantsData = [];
    render(<PeppolParticipantCard />);
    expect(screen.getByText('Not registered on Peppol')).toBeInTheDocument();
    // CTA is a real button (keyboard-focusable)
    const cta = screen.getByRole('button', { name: /register peppol participant/i });
    expect(cta.tagName).toBe('BUTTON');
  });

  it('renders status pill + participant ID (mono, LTR) when participant is ACTIVE', () => {
    participantsData = [
      {
        id: 'p1',
        status: 'ACTIVE',
        schemeId: '0060',
        identifierValue: '12345678',
        participantId: '0060:12345678',
        aspProvider: 'storecove',
        createdAt: new Date().toISOString(),
        lastCapabilityCheckAt: new Date().toISOString(),
      },
    ];
    render(<PeppolParticipantCard />);
    // Status label appears twice (pill + dl). Presence is sufficient.
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    const bdi = screen.getByTestId('participant-id');
    expect(bdi.tagName).toBe('BDI');
    expect(bdi).toHaveAttribute('dir', 'ltr');
    expect(bdi.textContent).toBe('0060:12345678');
    // Deregister destructive CTA present
    expect(
      screen.getByRole('button', { name: /deregister participant/i }),
    ).toBeInTheDocument();
  });

  it('treats the only DEREGISTERED row as "not registered" (renders empty state)', () => {
    participantsData = [
      {
        id: 'p1',
        status: 'DEREGISTERED',
        schemeId: '0060',
        identifierValue: '12345678',
        participantId: '0060:12345678',
        aspProvider: 'storecove',
        createdAt: new Date().toISOString(),
        lastCapabilityCheckAt: null,
      },
    ];
    render(<PeppolParticipantCard />);
    expect(screen.getByText('Not registered on Peppol')).toBeInTheDocument();
  });

  it('renders PENDING pill when participant is PENDING', () => {
    participantsData = [
      {
        id: 'p2',
        status: 'PENDING',
        schemeId: '0088',
        identifierValue: 'GLN-0001',
        participantId: '0088:GLN-0001',
        aspProvider: 'storecove',
        createdAt: new Date().toISOString(),
        lastCapabilityCheckAt: null,
      },
    ];
    render(<PeppolParticipantCard />);
    // Pending copy comes from EInvoice.PeppolDialog.pendingHeading and appears
    // in both the status pill and the Status dl row (≥1).
    expect(screen.getAllByText(/registration pending/i).length).toBeGreaterThan(0);
  });
});
