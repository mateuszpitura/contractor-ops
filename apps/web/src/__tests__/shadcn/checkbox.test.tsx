import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { render, screen, setup } from '@/test/test-utils';

describe('Checkbox', () => {
  it('renders a checkbox', () => {
    render(<Checkbox aria-label="Accept" />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('sets data-slot=checkbox', () => {
    render(<Checkbox aria-label="Accept" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('data-slot', 'checkbox');
  });

  it('is unchecked by default', () => {
    render(<Checkbox aria-label="Accept" />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('can be toggled by clicking', async () => {
    const onCheckedChange = vi.fn();
    const { user } = setup(<Checkbox aria-label="Accept" onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  it('respects checked prop', () => {
    render(<Checkbox aria-label="Accept" checked />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('respects disabled prop', () => {
    render(<Checkbox aria-label="Accept" disabled />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not fire onCheckedChange when disabled', async () => {
    const onCheckedChange = vi.fn();
    const { user } = setup(
      <Checkbox aria-label="Accept" disabled onCheckedChange={onCheckedChange} />,
    );
    await user.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('merges custom className', () => {
    render(<Checkbox aria-label="Accept" className="custom" />);
    expect(screen.getByRole('checkbox').className).toContain('custom');
  });
});
