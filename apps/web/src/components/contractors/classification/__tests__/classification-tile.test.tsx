// Phase 58 Plan 05 Task 2 — ClassificationTile behaviour contract.
//
// CT-1 loading skeleton, CT-2 empty state + CTA, CT-3 completed (verdict pill
// + relative date + view-details + re-run).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLatest: { current: { isPending: boolean; data: unknown } } = {
  current: { isPending: false, data: null },
};

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => mockLatest.current,
  };
});

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    classification: {
      getLatest: {
        queryOptions: (input: { contractorAssignmentId: string }) => ({
          queryKey: [['classification', 'getLatest'], input],
        }),
      },
    },
  },
}));

import { render, screen } from '@/test/test-utils';

import { ClassificationTile } from '../classification-tile';

const engagement = {
  id: 'eng-1',
  name: 'Acme — Widgets',
  contractorId: 'c-1',
  countryCode: 'GB' as const,
};

describe('ClassificationTile (Plan 05 Task 2)', () => {
  beforeEach(() => {
    mockLatest.current = { isPending: false, data: null };
  });

  it('CT-1 loading: renders the skeleton while isPending', () => {
    mockLatest.current = { isPending: true, data: undefined };
    render(<ClassificationTile engagement={engagement} />);
    expect(screen.getByTestId('classification-tile-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('classification-tile-verdict')).not.toBeInTheDocument();
  });

  it('CT-2 empty: renders empty-state copy and the Run-assessment CTA', () => {
    mockLatest.current = { isPending: false, data: null };
    render(<ClassificationTile engagement={engagement} />);
    expect(screen.getByText(/No classification assessment/i)).toBeInTheDocument();
    const cta = screen.getByTestId('classification-engagement-cta');
    expect(cta).toBeInTheDocument();
    expect(cta.closest('a')?.getAttribute('href') ?? '').toContain(
      `/contractors/${engagement.contractorId}/engagements/${engagement.id}/classification`,
    );
  });

  it('CT-3 completed: renders verdict pill + view-details link + re-run button', () => {
    const completedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    mockLatest.current = {
      isPending: false,
      data: {
        id: 'a-1',
        ruleSetVersion: 'IR35-2024-CEST',
        completedAt,
        outcome: {
          kind: 'IR35',
          verdict: 'outside',
          ruleSetVersion: 'IR35-2024-CEST',
          areas: [],
          computedAt: completedAt.toISOString(),
        },
      },
    };
    render(<ClassificationTile engagement={engagement} />);
    expect(screen.getByTestId('classification-tile-verdict')).toBeInTheDocument();

    const viewDetails = screen.getByTestId('classification-tile-view-details');
    const href = viewDetails.closest('a')?.getAttribute('href') ?? '';
    expect(href).toContain(
      `/contractors/${engagement.contractorId}/engagements/${engagement.id}/classification/a-1`,
    );

    expect(screen.getByTestId('classification-tile-rerun')).toBeInTheDocument();
  });
});
