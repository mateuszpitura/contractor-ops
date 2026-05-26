import { render, screen, setup } from '@/test/test-utils';

import { IntakeFilterChips, parseFilterParam } from '../intake-filter-chips';

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
    render(<IntakeFilterChips value="all" onChange={vi.fn()} />);
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it('marks the controlled value as selected', () => {
    render(<IntakeFilterChips value="needsReview" onChange={vi.fn()} />);
    const needsReview = screen.getByRole('tab', { name: 'Needs review' });
    expect(needsReview).toHaveAttribute('aria-selected', 'true');
    expect(needsReview).toHaveAttribute('data-state', 'active');
  });

  it('fires onChange with the clicked filter value', async () => {
    const onChange = vi.fn();
    const { user } = setup(<IntakeFilterChips value="all" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'Matched' }));
    expect(onChange).toHaveBeenCalledWith('matched');
  });

  it('ArrowRight from "All" moves focus to "Needs review" without selecting', async () => {
    const onChange = vi.fn();
    const { user } = setup(<IntakeFilterChips value="all" onChange={onChange} />);
    const allChip = screen.getByRole('tab', { name: 'All' });
    allChip.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Needs review' })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });
});
