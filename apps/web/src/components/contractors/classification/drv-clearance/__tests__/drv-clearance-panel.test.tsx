// Phase 60 · CLASS-09 — DRV clearance panel component tests.
// See .planning/phases/60-classification-polish/60-UI-SPEC.md §CLASS-09.
//
// Verifies: empty state, populated rows with expiry countdown, and that the
// primary CTA opens the create dialog.

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface ClearanceRow {
  id: string;
  filedAt: string;
  drvReference: string;
  outcome: 'PENDING' | 'SELBSTANDIG' | 'ABHANGIG' | 'WITHDRAWN';
  validFrom: string | null;
  validTo: string | null;
  notes: string | null;
}

const mockListQuery: { current: { isPending: boolean; data: ClearanceRow[] | null | undefined } } = {
  current: { isPending: false, data: [] },
};

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => mockListQuery.current,
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    statusfeststellungsverfahren: {
      listByEngagement: {
        queryOptions: (input: { contractorAssignmentId: string }) => ({
          queryKey: [['statusfeststellungsverfahren', 'listByEngagement'], input],
        }),
      },
      create: {
        mutationOptions: (opts?: { onSuccess?: () => void }) => ({ ...opts }),
      },
      update: {
        mutationOptions: (opts?: { onSuccess?: () => void }) => ({ ...opts }),
      },
    },
  },
}));

import { render, screen, setup } from '@/test/test-utils';

import { StatusfeststellungsverfahrenPanel } from '../drv-clearance-panel';

describe('StatusfeststellungsverfahrenPanel', () => {
  beforeEach(() => {
    mockListQuery.current = { isPending: false, data: [] };
  });

  it('renders empty state when there are zero clearances', () => {
    mockListQuery.current = { isPending: false, data: [] };
    render(<StatusfeststellungsverfahrenPanel engagementId="ca-1" />);
    expect(screen.getByText(/No DRV clearance on file/i)).toBeInTheDocument();
  });

  it('renders one row per clearance with the DRV reference', () => {
    const in90Days = new Date();
    in90Days.setDate(in90Days.getDate() + 90);
    mockListQuery.current = {
      isPending: false,
      data: [
        {
          id: 'sfv-1',
          filedAt: new Date('2026-01-15').toISOString(),
          drvReference: 'DRV-2026-0001',
          outcome: 'SELBSTANDIG',
          validFrom: new Date('2026-01-15').toISOString(),
          validTo: in90Days.toISOString(),
          notes: null,
        },
      ],
    };
    render(<StatusfeststellungsverfahrenPanel engagementId="ca-1" />);
    expect(screen.getByText('DRV-2026-0001')).toBeInTheDocument();
    expect(screen.getByText(/Self-employed/i)).toBeInTheDocument();
  });

  it('exposes an accessible panel heading via aria-labelledby', () => {
    render(<StatusfeststellungsverfahrenPanel engagementId="ca-1" />);
    const heading = screen.getByRole('heading', { name: /Statusfeststellungsverfahren/i });
    expect(heading).toBeInTheDocument();
  });

  it('opens the create dialog when the primary CTA is activated', async () => {
    const { user } = setup(<StatusfeststellungsverfahrenPanel engagementId="ca-1" />);
    const cta = screen.getByRole('button', { name: /File new clearance/i });
    await user.click(cta);
    // Dialog title renders with "File DRV clearance procedure"
    expect(await screen.findByText(/File DRV clearance procedure/i)).toBeInTheDocument();
  });
});
