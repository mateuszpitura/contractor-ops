import { render, screen } from '@/test/test-utils';

import type { IntakeStatus } from '../intake-status-pill';
import { IntakeStatusPill } from '../intake-status-pill';

const STATUS_CLASS_EXPECTATIONS: Record<IntakeStatus, string[]> = {
  PARSED: ['bg-muted', 'text-muted-foreground'],
  NEEDS_REVIEW: ['bg-amber-500/10', 'text-amber-800'],
  MATCHED: ['bg-blue-500/10', 'text-blue-700'],
  CONVERTED: ['bg-green-600/10', 'text-green-800'],
  REJECTED: ['bg-destructive/10', 'text-destructive'],
};

const STATUS_LABELS: Record<IntakeStatus, string> = {
  PARSED: 'Parsed',
  NEEDS_REVIEW: 'Needs review',
  MATCHED: 'Matched',
  CONVERTED: 'Converted',
  REJECTED: 'Rejected',
};

describe('IntakeStatusPill', () => {
  it.each(
    Object.keys(STATUS_CLASS_EXPECTATIONS) as IntakeStatus[],
  )('renders %s with the correct token classes', status => {
    render(<IntakeStatusPill status={status} />);
    const pill = screen.getByRole('status');
    for (const token of STATUS_CLASS_EXPECTATIONS[status]) {
      expect(pill.className).toContain(token);
    }
  });

  it('includes a decorative icon marked aria-hidden', () => {
    const { container } = render(<IntakeStatusPill status="PARSED" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('sets aria-label to the translated status string', () => {
    render(<IntakeStatusPill status="NEEDS_REVIEW" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', STATUS_LABELS.NEEDS_REVIEW);
  });

  it('renders the label as visible text (colour + icon + text triad)', () => {
    render(<IntakeStatusPill status="MATCHED" />);
    expect(screen.getByText(STATUS_LABELS.MATCHED)).toBeInTheDocument();
  });

  it('exposes the status via data-status for integration hooks', () => {
    render(<IntakeStatusPill status="CONVERTED" />);
    expect(screen.getByRole('status').getAttribute('data-status')).toBe('CONVERTED');
  });
});
