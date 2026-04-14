import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';

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
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    peppol: {
      retryTransmission: { mutationOptions: (opts: Record<string, unknown>) => opts },
      getTransmissions: { queryKey: () => ['peppol', 'getTransmissions'] },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { PeppolTransmissionStatus } from '../peppol-transmission-status';

function makeTransmission(
  overrides: Partial<{
    id: string;
    status: string;
    aspTransmissionId: string | null;
    transmittedAt: string | null;
    deliveredAt: string | null;
    createdAt: string;
    errorMessage: string | null;
  }> = {},
) {
  return {
    id: 'tx-001',
    status: 'PENDING',
    aspTransmissionId: null,
    transmittedAt: null,
    deliveredAt: null,
    createdAt: '2026-03-10T08:00:00Z',
    errorMessage: null,
    ...overrides,
  };
}

describe('PeppolTransmissionStatus', () => {
  it('renders the transmission title', () => {
    render(<PeppolTransmissionStatus transmission={makeTransmission()} />);
    expect(screen.getByText('title')).toBeInTheDocument();
  });

  it('shows Pending badge for PENDING status', () => {
    render(<PeppolTransmissionStatus transmission={makeTransmission({ status: 'PENDING' })} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows Delivered badge for DELIVERED status', () => {
    render(
      <PeppolTransmissionStatus
        transmission={makeTransmission({
          status: 'DELIVERED',
          transmittedAt: '2026-03-10T09:00:00Z',
          deliveredAt: '2026-03-10T09:05:00Z',
        })}
      />,
    );
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });

  it('shows Transmitted badge for TRANSMITTED status', () => {
    render(
      <PeppolTransmissionStatus
        transmission={makeTransmission({
          status: 'TRANSMITTED',
          transmittedAt: '2026-03-10T09:00:00Z',
        })}
      />,
    );
    expect(screen.getByText('Transmitted')).toBeInTheDocument();
  });

  it('shows Failed badge for FAILED status', () => {
    render(
      <PeppolTransmissionStatus
        transmission={makeTransmission({
          status: 'FAILED',
          errorMessage: 'Connection timeout',
        })}
      />,
    );
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows Rejected badge for REJECTED status', () => {
    render(
      <PeppolTransmissionStatus
        transmission={makeTransmission({ status: 'REJECTED', errorMessage: 'Invalid UBL' })}
      />,
    );
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('shows ASP reference when collapsible is expanded', async () => {
    const { user } = setup(
      <PeppolTransmissionStatus
        transmission={makeTransmission({
          status: 'TRANSMITTED',
          aspTransmissionId: 'asp-ref-42',
          transmittedAt: '2026-03-10T09:00:00Z',
        })}
      />,
    );
    // Expand the collapsible by clicking the trigger
    await user.click(screen.getByText('title'));
    expect(screen.getByText(/asp-ref-42/)).toBeInTheDocument();
  });

  it('shows retry button for FAILED transmission when expanded', async () => {
    const { user } = setup(
      <PeppolTransmissionStatus
        transmission={makeTransmission({
          status: 'FAILED',
          errorMessage: 'Timeout',
        })}
      />,
    );
    await user.click(screen.getByText('title'));
    expect(screen.getByRole('button', { name: /retryTransmission/ })).toBeInTheDocument();
  });

  it('does not show retry button for successful transmission when expanded', async () => {
    const { user } = setup(
      <PeppolTransmissionStatus
        transmission={makeTransmission({
          status: 'DELIVERED',
          transmittedAt: '2026-03-10T09:00:00Z',
          deliveredAt: '2026-03-10T09:05:00Z',
        })}
      />,
    );
    await user.click(screen.getByText('title'));
    expect(screen.queryByRole('button', { name: /retryTransmission/ })).not.toBeInTheDocument();
  });
});
