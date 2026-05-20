import { Badge, badgeVariants } from '@contractor-ops/ui/components/shadcn/badge';
import { render, screen } from '@/test/test-utils';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders as a span by default', () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText('Label').tagName).toBe('SPAN');
  });

  it('applies the default variant when none specified', () => {
    render(<Badge>Default</Badge>);
    const el = screen.getByText('Default');
    expect(el.className).toContain('bg-primary');
  });

  it.each([
    ['destructive', 'bg-destructive'],
    ['secondary', 'bg-secondary'],
    ['outline', 'border'],
    ['info', 'bg-blue-500'],
    ['warning', 'bg-amber-500'],
    ['success', 'bg-green-600'],
    ['success-solid', 'bg-green-600'],
  ] as const)('renders variant=%s with correct class', (variant, expected) => {
    render(<Badge variant={variant}>{variant}</Badge>);
    expect(screen.getByText(variant).className).toContain(expected);
  });

  it('merges custom className with variant classes', () => {
    render(<Badge className="my-custom">Merged</Badge>);
    const el = screen.getByText('Merged');
    expect(el.className).toContain('my-custom');
    expect(el.className).toContain('bg-primary');
  });

  it('forwards data attributes', () => {
    render(<Badge data-testid="test-badge">Test</Badge>);
    expect(screen.getByTestId('test-badge')).toBeInTheDocument();
  });

  it('exports badgeVariants for external usage', () => {
    expect(typeof badgeVariants).toBe('function');
    const classes = badgeVariants({ variant: 'destructive' });
    expect(classes).toContain('bg-destructive');
  });
});
