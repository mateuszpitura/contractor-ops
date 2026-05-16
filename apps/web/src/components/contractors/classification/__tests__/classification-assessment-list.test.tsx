import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListQuery: { current: { isPending: boolean; data: unknown } } = {
  current: { isPending: false, data: null },
};

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => mockListQuery.current,
  };
});

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [k: string]: unknown;
  }) => (
    <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/test',
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    classification: {
      listByContractor: {
        queryOptions: (input: { contractorId: string }) => ({
          queryKey: [['classification', 'listByContractor'], input],
        }),
      },
    },
  },
}));

import { render, screen } from '@/test/test-utils';

import { ClassificationAssessmentList } from '../classification-assessment-list';

describe('ClassificationAssessmentList', () => {
  beforeEach(() => {
    mockListQuery.current = { isPending: false, data: null };
  });

  it('renders skeleton rows while pending', () => {
    mockListQuery.current = { isPending: true, data: undefined };

    render(<ClassificationAssessmentList contractorId="c-1" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders empty state when no assessments exist', () => {
    mockListQuery.current = { isPending: false, data: [] };

    render(<ClassificationAssessmentList contractorId="c-1" />);

    // Empty state text from Classification.list.empty
    const emptyText = document.querySelector('p.text-sm');
    expect(emptyText).toBeInTheDocument();
  });

  it('renders rows when assessments are returned', () => {
    mockListQuery.current = {
      isPending: false,
      data: [
        {
          id: 'a-1',
          status: 'completed',
          countryCode: 'GB',
          ruleSetVersion: 'IR35-2024-CEST',
          completedAt: '2025-06-01T00:00:00Z',
          contractorAssignmentId: 'eng-1',
          outcome: {
            kind: 'IR35',
            verdict: 'outside',
            ruleSetVersion: 'IR35-2024-CEST',
            areas: [],
            computedAt: '2025-06-01T00:00:00Z',
          },
        },
      ],
    };

    render(<ClassificationAssessmentList contractorId="c-1" />);

    // Should render the engagement id
    expect(screen.getAllByText('eng-1').length).toBeGreaterThanOrEqual(1);
    // Should render country code
    expect(screen.getAllByText('GB').length).toBeGreaterThanOrEqual(1);
  });

  it('renders draft badge for non-completed assessments', () => {
    mockListQuery.current = {
      isPending: false,
      data: [
        {
          id: 'a-2',
          status: 'draft',
          countryCode: 'DE',
          ruleSetVersion: 'DRV-2024-v1',
          completedAt: null,
          contractorAssignmentId: 'eng-2',
          outcome: null,
        },
      ],
    };

    render(<ClassificationAssessmentList contractorId="c-1" />);

    // Draft badge should be rendered (both desktop table and mobile card)
    const badges = screen.getAllByText(/draft/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });
});
