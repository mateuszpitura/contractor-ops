import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// next/navigation + @/i18n/navigation mocks — the chip component reads
// `useSearchParams` + writes via `router.replace`. We fake both.
// ---------------------------------------------------------------------------

const mockRouterReplace = vi.fn();
let searchParamsString = '';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Import after mocks so the chip module picks them up.
import { render, screen, setup } from '@/test/test-utils';
import { IntakeFilterChips, parseFilterParam } from '../intake-filter-chips';

// jsdom doesn't give us window.location mutation, but we don't need it —
// the component reads `window.location.pathname` only. Provide a stub.
Object.defineProperty(window, 'location', {
  value: { pathname: '/en/invoices/intake' },
  writable: true,
});

beforeEach(() => {
  mockRouterReplace.mockReset();
  searchParamsString = '';
});

describe('parseFilterParam', () => {
  it('maps known status tokens back to their filter value', () => {
    expect(parseFilterParam('NEEDS_REVIEW')).toBe('needsReview');
    expect(parseFilterParam('MATCHED')).toBe('matched');
    expect(parseFilterParam('CONVERTED')).toBe('converted');
    expect(parseFilterParam('REJECTED')).toBe('rejected');
  });

  it('defaults to "all" on null / unknown tokens', () => {
    expect(parseFilterParam(null)).toBe('all');
    expect(parseFilterParam('GARBAGE')).toBe('all');
    expect(parseFilterParam('')).toBe('all');
  });
});

describe('IntakeFilterChips', () => {
  it('renders all 5 chips as tab buttons', () => {
    render(<IntakeFilterChips />);
    // Chips have role="tab" inside a tablist.
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it('marks the "All" chip as selected by default (no ?status)', () => {
    render(<IntakeFilterChips />);
    const allChip = screen.getByRole('tab', { name: 'All' });
    expect(allChip.getAttribute('data-state')).toBe('active');
    expect(allChip).toHaveAttribute('aria-selected', 'true');
  });

  it('reflects the URL ?status=NEEDS_REVIEW as the active chip', () => {
    searchParamsString = 'status=NEEDS_REVIEW';
    render(<IntakeFilterChips />);
    const needsReview = screen.getByRole('tab', { name: 'Needs review' });
    expect(needsReview.getAttribute('data-state')).toBe('active');
  });

  it('calls router.replace with the mapped status token when a chip is clicked', async () => {
    const { user } = setup(<IntakeFilterChips />);
    await user.click(screen.getByRole('tab', { name: 'Matched' }));
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    const calledWith = mockRouterReplace.mock.calls[0]?.[0] as string;
    expect(calledWith).toContain('status=MATCHED');
  });

  it('clears the ?status query param when "All" is clicked', async () => {
    searchParamsString = 'status=REJECTED';
    const { user } = setup(<IntakeFilterChips />);
    await user.click(screen.getByRole('tab', { name: 'All' }));
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    const calledWith = mockRouterReplace.mock.calls[0]?.[0] as string;
    expect(calledWith).not.toContain('status=');
  });

  it('ArrowRight from "All" moves focus to "Needs review" without selecting', async () => {
    const { user } = setup(<IntakeFilterChips />);
    const allChip = screen.getByRole('tab', { name: 'All' });
    allChip.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Needs review' })).toHaveFocus();
    // Moving focus never triggers a router replace — keyboard nav is
    // separate from selection (WAI-ARIA tablist pattern).
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('supports controlled mode via value + onChange', async () => {
    const handleChange = vi.fn();
    const { user } = setup(<IntakeFilterChips value="converted" onChange={handleChange} />);
    expect(screen.getByRole('tab', { name: 'Converted' }).getAttribute('data-state')).toBe(
      'active',
    );
    await user.click(screen.getByRole('tab', { name: 'Rejected' }));
    expect(handleChange).toHaveBeenCalledWith('rejected');
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});
