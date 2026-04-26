import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { DocLinkChip } from '../doc-link-chip';

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
      // Clone render prop and inject children
      const { props } = renderProp as React.ReactElement<Record<string, unknown>>;
      return <a {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>{children}</a>;
    }
    return <div>{children}</div>;
  },
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('../provider-icons', () => ({
  NotionIcon: ({ className }: { className?: string }) => (
    <span data-testid="notion-icon" className={className} />
  ),
  ConfluenceIcon: ({ className }: { className?: string }) => (
    <span data-testid="confluence-icon" className={className} />
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocLinkChip', () => {
  const baseProps = {
    id: 'link-1',
    title: 'Design Doc',
    url: 'https://notion.so/design-doc',
    provider: 'notion' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title text', () => {
    render(<DocLinkChip {...baseProps} />);
    expect(screen.getByText('Design Doc')).toBeInTheDocument();
  });

  it('renders a link pointing to the url', () => {
    render(<DocLinkChip {...baseProps} />);
    const link = screen.getByLabelText('Open Design Doc in Notion (new tab)');
    expect(link).toHaveAttribute('href', 'https://notion.so/design-doc');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders Notion icon for notion provider', () => {
    render(<DocLinkChip {...baseProps} />);
    expect(screen.getByTestId('notion-icon')).toBeInTheDocument();
  });

  it('renders Confluence icon for confluence provider', () => {
    render(<DocLinkChip {...baseProps} provider="confluence" />);
    expect(screen.getByTestId('confluence-icon')).toBeInTheDocument();
  });

  it('shows tooltip with relative time when lastEditedTime provided', () => {
    const now = new Date().toISOString();
    render(<DocLinkChip {...baseProps} lastEditedTime={now} />);
    expect(screen.getByText(/Last edited/)).toBeInTheDocument();
  });

  it('shows tooltip with provider name when no lastEditedTime', () => {
    render(<DocLinkChip {...baseProps} />);
    expect(screen.getByText('Open in Notion')).toBeInTheDocument();
  });

  it('shows tooltip with Confluence when provider is confluence', () => {
    render(<DocLinkChip {...baseProps} provider="confluence" />);
    expect(screen.getByText('Open in Confluence')).toBeInTheDocument();
  });

  it('does not show remove button in readOnly mode', () => {
    const onRemove = vi.fn();
    render(<DocLinkChip {...baseProps} readOnly={true} onRemove={onRemove} />);
    expect(screen.queryByLabelText('Remove link to Design Doc')).not.toBeInTheDocument();
  });

  it('does not show remove button when onRemove is undefined', () => {
    render(<DocLinkChip {...baseProps} />);
    expect(screen.queryByLabelText('Remove link to Design Doc')).not.toBeInTheDocument();
  });

  it('shows remove button when not readOnly and onRemove provided', () => {
    const onRemove = vi.fn();
    render(<DocLinkChip {...baseProps} onRemove={onRemove} />);
    expect(screen.getByLabelText('Remove link to Design Doc')).toBeInTheDocument();
  });

  it('opens confirmation dialog when remove button clicked', async () => {
    const onRemove = vi.fn();
    const { user } = setup(<DocLinkChip {...baseProps} onRemove={onRemove} />);
    await user.click(screen.getByLabelText('Remove link to Design Doc'));
    expect(screen.getByText('Remove Document Link')).toBeInTheDocument();
  });

  it('calls onRemove when confirmation is accepted', async () => {
    const onRemove = vi.fn();
    const { user } = setup(<DocLinkChip {...baseProps} onRemove={onRemove} />);
    await user.click(screen.getByLabelText('Remove link to Design Doc'));
    await user.click(screen.getByText('Remove Link'));
    expect(onRemove).toHaveBeenCalledWith('link-1');
  });

  it('shows Keep Link cancel button in confirmation dialog', async () => {
    const onRemove = vi.fn();
    const { user } = setup(<DocLinkChip {...baseProps} onRemove={onRemove} />);
    await user.click(screen.getByLabelText('Remove link to Design Doc'));
    expect(screen.getByText('Keep Link')).toBeInTheDocument();
  });
});
