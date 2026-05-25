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
import {
  DocumentHistoryListEmpty,
  DocumentHistoryListSkeleton,
  DocumentHistoryListView,
} from '../document-history-list.js';

// Minimal-shape factory keeps tests focused on the view's a11y / DOM
// structure; the extra rule-set / hash / renderer-version fields are
// required by the runtime type but irrelevant to the assertions.
const makeDoc = (
  over: Partial<{
    id: string;
    kind: 'SDS' | 'DRV_DEFENSE_BUNDLE';
    generatedAt: Date;
    byteSize: number;
  }> = {},
) => ({
  id: 'd1',
  kind: 'SDS' as const,
  generatedAt: new Date('2025-06-01T00:00:00Z'),
  byteSize: 45056,
  ruleSetVersion: 'v1.0.0',
  sha256Hash: 'a'.repeat(64),
  rendererVersion: '1.0.0',
  ...over,
});

describe('DocumentHistoryListView', () => {
  it('renders the heading', () => {
    render(
      <DocumentHistoryListView
        engagementId="eng-1"
        docs={[makeDoc()]}
        downloadDocument={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('renders empty-state text when no documents', () => {
    render(<DocumentHistoryListEmpty />);
    const emptyText = document.querySelector('p.text-sm');
    expect(emptyText).toBeInTheDocument();
  });

  it('renders one <li> per document', () => {
    render(
      <DocumentHistoryListView
        engagementId="eng-1"
        docs={[
          makeDoc(),
          makeDoc({
            id: 'd2',
            kind: 'DRV_DEFENSE_BUNDLE',
            generatedAt: new Date('2025-06-02T00:00:00Z'),
            byteSize: 120000,
          }),
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
        docs={[makeDoc()]}
        downloadDocument={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(1);
  });

  it('renders section with aria-labelledby for a11y', () => {
    render(<DocumentHistoryListEmpty />);
    expect(document.querySelector('section[aria-labelledby]')).toBeInTheDocument();
  });

  it('shows skeleton items when pending', () => {
    const { container } = render(<DocumentHistoryListSkeleton />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
