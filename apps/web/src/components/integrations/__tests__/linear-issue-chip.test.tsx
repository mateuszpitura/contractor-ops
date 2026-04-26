import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { LinearIssueChip } from '../linear-issue-chip';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({
    children,
    render: renderProp,
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
  }) => {
    if (renderProp) {
      const { props } = renderProp as React.ReactElement<Record<string, unknown>>;
      return <a {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>{children}</a>;
    }
    return <div>{children}</div>;
  },
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LinearIssueChip', () => {
  const baseProps = {
    identifier: 'ENG-123',
    title: 'Implement dark mode',
    status: 'In Progress',
    statusType: 'started' as const,
    url: 'https://linear.app/team/ENG-123',
  };

  it('renders the identifier', () => {
    render(<LinearIssueChip {...baseProps} />);
    expect(screen.getByText('ENG-123')).toBeInTheDocument();
  });

  it('renders the status text', () => {
    render(<LinearIssueChip {...baseProps} />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders a link to the issue url', () => {
    render(<LinearIssueChip {...baseProps} />);
    const link = screen.getByLabelText('Open Linear issue ENG-123 in new tab');
    expect(link).toHaveAttribute('href', 'https://linear.app/team/ENG-123');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders title in tooltip', () => {
    render(<LinearIssueChip {...baseProps} />);
    expect(screen.getByText('Implement dark mode')).toBeInTheDocument();
  });

  it('renders status dot', () => {
    const { container } = render(<LinearIssueChip {...baseProps} />);
    const dot = container.querySelector('.rounded-full');
    expect(dot).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<LinearIssueChip {...baseProps} className="extra" />);
    const link = screen.getByLabelText('Open Linear issue ENG-123 in new tab');
    expect(link.className).toContain('extra');
  });

  it('uses bg-info for started statusType', () => {
    const { container } = render(<LinearIssueChip {...baseProps} />);
    const dot = container.querySelector('.rounded-full');
    expect(dot?.className).toContain('bg-info');
  });

  it('uses bg-success for completed statusType', () => {
    const { container } = render(<LinearIssueChip {...baseProps} statusType="completed" />);
    const dot = container.querySelector('.rounded-full');
    expect(dot?.className).toContain('bg-success');
  });

  it('uses bg-destructive for cancelled statusType', () => {
    const { container } = render(<LinearIssueChip {...baseProps} statusType="cancelled" />);
    const dot = container.querySelector('.rounded-full');
    expect(dot?.className).toContain('bg-destructive');
  });

  it('uses bg-muted-foreground for backlog statusType', () => {
    const { container } = render(<LinearIssueChip {...baseProps} statusType="backlog" />);
    const dot = container.querySelector('.rounded-full');
    expect(dot?.className).toContain('bg-muted-foreground');
  });
});
