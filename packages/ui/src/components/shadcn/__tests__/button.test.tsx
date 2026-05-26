import { render, screen, setup } from '../../../__tests__/test-utils.js';
import { Button, buttonVariants } from '../button.js';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('renders as a button element', () => {
    render(<Button>Btn</Button>);
    expect(screen.getByRole('button').tagName).toBe('BUTTON');
  });

  it('applies default variant and size', () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-primary');
    expect(btn.className).toContain('h-8');
  });

  it.each([
    ['outline', 'border'],
    ['secondary', 'bg-secondary'],
    ['ghost', 'hover:bg-muted'],
    ['destructive', 'bg-destructive'],
    ['link', 'underline-offset'],
  ] as const)('renders variant=%s', (variant, expected) => {
    render(<Button variant={variant}>{variant}</Button>);
    expect(screen.getByRole('button').className).toContain(expected);
  });

  it.each([
    ['sm', 'h-7'],
    ['lg', 'h-9'],
    ['icon', 'size-8'],
    ['xs', 'h-6'],
  ] as const)('renders size=%s', (size, expected) => {
    render(<Button size={size}>S</Button>);
    expect(screen.getByRole('button').className).toContain(expected);
  });

  it('handles click events', async () => {
    const onClick = vi.fn();
    const { user } = setup(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire click when disabled', async () => {
    const onClick = vi.fn();
    const { user } = setup(
      <Button onClick={onClick} disabled>
        Disabled
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies disabled styling', () => {
    render(<Button disabled>Off</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('merges custom className', () => {
    render(<Button className="custom-class">Merge</Button>);
    expect(screen.getByRole('button').className).toContain('custom-class');
  });

  it('sets data-slot=button', () => {
    render(<Button>Slot</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-slot', 'button');
  });

  it('exports buttonVariants for external usage', () => {
    expect(typeof buttonVariants).toBe('function');
    const classes = buttonVariants({ variant: 'destructive', size: 'lg' });
    expect(classes).toContain('bg-destructive');
    expect(classes).toContain('h-9');
  });
});
