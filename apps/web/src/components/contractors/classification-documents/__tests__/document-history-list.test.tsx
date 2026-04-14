import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListData: { current: { data: unknown[] | undefined } } = {
  current: { data: undefined },
};

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => mockListData.current,
    useQueryClient: () => ({
      fetchQuery: vi.fn().mockResolvedValue({ url: 'https://example.com/download' }),
    }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    classificationDocument: {
      listByEngagement: {
        queryOptions: (input: { contractorAssignmentId: string }) => ({
          queryKey: [['classificationDocument', 'listByEngagement'], input],
        }),
      },
      getDownloadUrl: {
        queryOptions: (input: { classificationDocumentId: string }) => ({
          queryKey: [['classificationDocument', 'getDownloadUrl'], input],
        }),
      },
    },
  },
}));

import { render, screen } from '@/test/test-utils';

import { DocumentHistoryList } from '../document-history-list';

describe('DocumentHistoryList', () => {
  beforeEach(() => {
    mockListData.current = { data: undefined };
  });

  it('renders the heading', () => {
    mockListData.current = { data: [] };

    render(<DocumentHistoryList engagementId="eng-1" />);

    // Section heading from Classification.documents.documentHistory
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('renders empty state when no documents exist', () => {
    mockListData.current = { data: [] };

    render(<DocumentHistoryList engagementId="eng-1" />);

    // Empty state text
    const emptyText = document.querySelector('p.text-sm');
    expect(emptyText).toBeInTheDocument();
  });

  it('renders document rows when data is present', () => {
    mockListData.current = {
      data: [
        {
          id: 'doc-1',
          kind: 'SDS',
          generatedAt: '2025-06-01T00:00:00Z',
          byteSize: 45056,
        },
        {
          id: 'doc-2',
          kind: 'DRV_DEFENSE_BUNDLE',
          generatedAt: '2025-06-02T00:00:00Z',
          byteSize: 120000,
        },
      ],
    };

    render(<DocumentHistoryList engagementId="eng-1" />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
  });

  it('renders download buttons for each document', () => {
    mockListData.current = {
      data: [
        {
          id: 'doc-1',
          kind: 'SDS',
          generatedAt: '2025-06-01T00:00:00Z',
          byteSize: 45056,
        },
      ],
    };

    render(<DocumentHistoryList engagementId="eng-1" />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders section with aria-labelledby for accessibility', () => {
    mockListData.current = { data: [] };

    render(<DocumentHistoryList engagementId="eng-1" />);

    const section = document.querySelector('section[aria-labelledby]');
    expect(section).toBeInTheDocument();
  });
});
