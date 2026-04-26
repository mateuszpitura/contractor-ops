import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock('next-intl', async importOriginal => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: () => (key: string) => key,
  };
});

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: mockUseQuery,
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    peppol: {
      getStatus: { queryOptions: () => ({}), queryKey: () => ['peppol', 'getStatus'] },
      getParticipant: { queryOptions: () => ({}), queryKey: () => ['peppol', 'getParticipant'] },
      disconnect: { mutationOptions: (opts: Record<string, unknown>) => opts },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../peppol-wizard', () => ({
  PeppolWizard: () => null,
}));

import { PeppolStatusCard } from '../peppol-status-card';

describe('PeppolStatusCard', () => {
  it('renders not-connected state with connect button when no status data', () => {
    mockUseQuery.mockReturnValue({ data: undefined });

    render(<PeppolStatusCard />);
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('notConnected')).toBeInTheDocument();
    expect(screen.getByText('connectDescription')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'connect' })).toBeInTheDocument();
  });

  it('renders connected state with participant info and status badge', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: {
          participant: {
            participantId: '0192:123456789012345',
            aspProvider: 'storecove',
            status: 'ACTIVE',
          },
          connection: { lastSyncAt: null },
        },
      })
      .mockReturnValueOnce({ data: undefined });

    render(<PeppolStatusCard />);
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('0192:123456789012345')).toBeInTheDocument();
    expect(screen.getByText('storecove')).toBeInTheDocument();
  });

  it('renders settings and disconnect buttons in connected state', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: {
          participant: {
            participantId: '0192:123456789012345',
            aspProvider: 'storecove',
            status: 'ACTIVE',
          },
          connection: { lastSyncAt: null },
        },
      })
      .mockReturnValueOnce({ data: undefined });

    render(<PeppolStatusCard />);
    expect(screen.getByText('settings')).toBeInTheDocument();
    expect(screen.getByText('disconnect')).toBeInTheDocument();
  });

  it('renders transmission metrics when counts are available', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: {
          participant: {
            participantId: '0192:123456789012345',
            aspProvider: 'storecove',
            status: 'ACTIVE',
          },
          connection: { lastSyncAt: null },
        },
      })
      .mockReturnValueOnce({
        data: {
          _count: {
            sentTransmissions: 25,
            receivedTransmissions: 12,
            failedTransmissions: 3,
          },
        },
      });

    render(<PeppolStatusCard />);
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('sent')).toBeInTheDocument();
    expect(screen.getByText('received')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('shows Pending badge for PENDING status', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: {
          participant: {
            participantId: '0192:999999999999999',
            aspProvider: 'storecove',
            status: 'PENDING',
          },
          connection: { lastSyncAt: null },
        },
      })
      .mockReturnValueOnce({ data: undefined });

    render(<PeppolStatusCard />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});
