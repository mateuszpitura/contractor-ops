import { render, screen } from '@/test/test-utils';
import { Separator } from '../separator';

describe('Separator', () => {
  it('renders a separator', () => {
    render(<Separator />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('sets data-slot=separator', () => {
    render(<Separator />);
    expect(screen.getByRole('separator')).toHaveAttribute('data-slot', 'separator');
  });

  it('defaults to horizontal orientation', () => {
    render(<Separator />);
    const el = screen.getByRole('separator');
    // base-ui may or may not set aria-orientation for horizontal (the default)
    const orientation = el.getAttribute('aria-orientation');
    expect(orientation === null || orientation === 'horizontal').toBe(true);
  });

  it('accepts vertical orientation', () => {
    render(<Separator orientation="vertical" />);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('merges custom className', () => {
    render(<Separator className="my-sep" />);
    expect(screen.getByRole('separator').className).toContain('my-sep');
  });

  it('forwards HTML attributes', () => {
    // biome-ignore lint/correctness/useUniqueElementIds: test render
    render(<Separator data-testid="sep" id="main-sep" />);
    expect(screen.getByTestId('sep')).toHaveAttribute('id', 'main-sep');
  });
});
