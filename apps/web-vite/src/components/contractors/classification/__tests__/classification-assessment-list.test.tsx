/**
 * web-vite port. View takes rows + isPending directly. Date formatter is
 * stubbed (it calls `useTRPC` for org locale settings).
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (v == null ? '' : String(v)),
    formatTime: (v: unknown) => (v == null ? '' : String(v)),
    formatDateTime: (v: unknown) => (v == null ? '' : String(v)),
  }),
}));

import { render, screen } from '../../../../test/test-utils.js';
import {
  ClassificationAssessmentListEmpty,
  ClassificationAssessmentListSkeleton,
  ClassificationAssessmentListView,
} from '../classification-assessment-list.js';
import type { AssessmentRow } from '../hooks/use-classification-assessment-list.js';

describe('ClassificationAssessmentListView', () => {
  it('renders skeleton card', () => {
    render(<ClassificationAssessmentListSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders empty state when no assessments exist', () => {
    render(<ClassificationAssessmentListEmpty />);
    const emptyText = document.querySelector('p.text-sm');
    expect(emptyText).toBeInTheDocument();
  });

  it('renders rows when assessments are returned', () => {
    const rows: AssessmentRow[] = [
      {
        id: 'a-1',
        status: 'COMPLETED',
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
    ];
    render(<ClassificationAssessmentListView contractorId="c-1" rows={rows} />);
    expect(screen.getAllByText('eng-1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('GB').length).toBeGreaterThanOrEqual(1);
  });

  it('renders draft badge for non-completed assessments', () => {
    const rows: AssessmentRow[] = [
      {
        id: 'a-2',
        status: 'DRAFT',
        countryCode: 'DE',
        ruleSetVersion: 'DRV-2024-v1',
        completedAt: null,
        contractorAssignmentId: 'eng-2',
        outcome: null,
      },
    ];
    render(<ClassificationAssessmentListView contractorId="c-1" rows={rows} />);
    const badges = screen.getAllByText(/draft/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });
});
