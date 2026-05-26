import { render, screen, setup } from '../../../__tests__/test-utils.js';
import { Switch } from '../switch.js';

describe('Switch', () => {
  it('renders a switch', () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('sets data-slot=switch', () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole('switch')).toHaveAttribute('data-slot', 'switch');
  });

  it('defaults to size=default', () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole('switch')).toHaveAttribute('data-size', 'default');
  });

  it('accepts size=sm', () => {
    render(<Switch aria-label="Toggle" size="sm" />);
    expect(screen.getByRole('switch')).toHaveAttribute('data-size', 'sm');
  });

  it('is unchecked by default', () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('can be toggled', async () => {
    const onCheckedChange = vi.fn();
    const { user } = setup(<Switch aria-label="Toggle" onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  it('respects checked prop', () => {
    render(<Switch aria-label="Toggle" checked />);
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('respects disabled prop', () => {
    render(<Switch aria-label="Toggle" disabled />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
  });

  it('merges custom className', () => {
    render(<Switch aria-label="Toggle" className="wide" />);
    expect(screen.getByRole('switch').className).toContain('wide');
  });
});
