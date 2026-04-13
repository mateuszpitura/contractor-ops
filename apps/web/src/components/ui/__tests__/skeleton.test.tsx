import { render, screen } from '@/test/test-utils';
import { Skeleton } from '../skeleton';

describe('Skeleton', () => {
  it('renders a div', () => {
    render(<Skeleton data-testid="skel" />);
    const el = screen.getByTestId('skel');
    expect(el.tagName).toBe('DIV');
  });

  it('sets data-slot=skeleton', () => {
    render(<Skeleton data-testid="skel" />);
    expect(screen.getByTestId('skel')).toHaveAttribute('data-slot', 'skeleton');
  });

  it('is hidden from screen readers', () => {
    render(<Skeleton data-testid="skel" />);
    expect(screen.getByTestId('skel')).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies shimmer animation class', () => {
    render(<Skeleton data-testid="skel" />);
    expect(screen.getByTestId('skel').className).toContain('animate-shimmer');
  });

  it('merges custom className', () => {
    render(<Skeleton data-testid="skel" className="h-4 w-32" />);
    const el = screen.getByTestId('skel');
    expect(el.className).toContain('h-4');
    expect(el.className).toContain('w-32');
  });

  it('forwards HTML attributes', () => {
    // biome-ignore lint/correctness/useUniqueElementIds: test render
    render(<Skeleton data-testid="skel" id="sk-1" />);
    expect(screen.getByTestId('skel')).toHaveAttribute('id', 'sk-1');
  });
});
