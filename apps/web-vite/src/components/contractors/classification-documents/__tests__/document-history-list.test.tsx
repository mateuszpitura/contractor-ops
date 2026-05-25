/**
 * web-vite port. View takes listQuery + docs + downloadDocument as injected props.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (v == null ? '' : 'Jun 1, 2025'),
    formatTime: () => '',
    formatDateTime: () => '',
  }),
}));

import { render, screen } from '../../../../test/test-utils.js';
import { DocumentHistoryListView } from '../document-history-list.js';

function makeListQuery(overrides: Partial<{ isPending: boolean }> = {}) {
  return {
    isPending: false,
    ...overrides,
  } as unknown as Parameters<typeof DocumentHistoryListView>[0]['listQuery'];
}

describe('DocumentHistoryListView', () => {
  it('renders the heading', () => {
    render(
      <DocumentHistoryListView
        engagementId="eng-1"
        listQuery={makeListQuery()}
        docs={[]}
        downloadDocument={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('renders empty-state text when no documents', () => {
    render(
      <DocumentHistoryListView
        engagementId="eng-1"
        listQuery={makeListQuery()}
        docs={[]}
        downloadDocument={vi.fn()}
      />,
    );
    const emptyText = document.querySelector('p.text-sm');
    expect(emptyText).toBeInTheDocument();
  });

  it('renders one <li> per document', () => {
    render(
      <DocumentHistoryListView
        engagementId="eng-1"
        listQuery={makeListQuery()}
        docs={[
          {
            id: 'd1',
            kind: 'SDS',
            generatedAt: new Date('2025-06-01T00:00:00Z'),
            byteSize: 45056,
            ruleSetVersion: 'v1',
            sha256Hash: 'a'.repeat(64),
            rendererVersion: 'r1',
          },
          {
            id: 'd2',
            kind: 'DRV_DEFENSE_BUNDLE',
            generatedAt: new Date('2025-06-02T00:00:00Z'),
            byteSize: 120000,
            ruleSetVersion: 'v1',
            sha256Hash: 'b'.repeat(64),
            rendererVersion: 'r1',
          },
        ]}
        downloadDocument={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders a download button per document', () => {
    render(
      <DocumentHistoryListView
        engagementId="eng-1"
        listQuery={makeListQuery()}
        docs={[
          {
            id: 'd1',
            kind: 'SDS',
            generatedAt: new Date('2025-06-01T00:00:00Z'),
            byteSize: 45056,
            ruleSetVersion: 'v1',
            sha256Hash: 'a'.repeat(64),
            rendererVersion: 'r1',
          },
        ]}
        downloadDocument={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(1);
  });

  it('renders section with aria-labelledby for a11y', () => {
    render(
      <DocumentHistoryListView
        engagementId="eng-1"
        listQuery={makeListQuery()}
        docs={[]}
        downloadDocument={vi.fn()}
      />,
    );
    expect(document.querySelector('section[aria-labelledby]')).toBeInTheDocument();
  });

  it('shows skeleton items when listQuery.isPending', () => {
    const { container } = render(
      <DocumentHistoryListView
        engagementId="eng-1"
        listQuery={makeListQuery({ isPending: true })}
        docs={[]}
        downloadDocument={vi.fn()}
      />,
    );
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
