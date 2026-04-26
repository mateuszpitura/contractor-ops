import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import type { IntakeStatus } from '../intake-status-pill';
import { IntakeStatusPill } from '../intake-status-pill';

// ---------------------------------------------------------------------------
// Expected token-class substrings for each intake status.
// Mirrors STATUS_VISUALS in intake-status-pill.tsx — kept as a small table
// so each case gets an individual `it` block with explicit assertions.
// ---------------------------------------------------------------------------

const STATUS_CLASS_EXPECTATIONS: Record<IntakeStatus, string[]> = {
  PARSED: ['bg-muted', 'text-muted-foreground'],
  NEEDS_REVIEW: ['bg-amber-500/10', 'text-amber-700'],
  MATCHED: ['bg-blue-500/10', 'text-blue-700'],
  CONVERTED: ['bg-green-600/10', 'text-green-700'],
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
    // Lucide icons render as SVGs with `aria-hidden="true"` when we pass it.
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('sets aria-label to the translated status string so colour is never the sole signal', () => {
    render(<IntakeStatusPill status="NEEDS_REVIEW" />);
    const pill = screen.getByRole('status');
    expect(pill).toHaveAttribute('aria-label', STATUS_LABELS.NEEDS_REVIEW);
  });

  it('also renders the label as visible text (triad: colour + icon + text)', () => {
    render(<IntakeStatusPill status="MATCHED" />);
    expect(screen.getByText(STATUS_LABELS.MATCHED)).toBeInTheDocument();
  });

  it('exposes the status via data-status for integration hooks (e.g. e2e)', () => {
    render(<IntakeStatusPill status="CONVERTED" />);
    const pill = screen.getByRole('status');
    expect(pill.getAttribute('data-status')).toBe('CONVERTED');
  });
});
