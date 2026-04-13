import { FileText } from 'lucide-react';

import { render, screen, setup } from '@/test/test-utils';
import { EmptyState } from '../empty-state';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('EmptyState', () => {
  // ---------------------------------------------------------------------------
  // Basic rendering
  // ---------------------------------------------------------------------------

  it('renders heading and body text', () => {
    render(
      <EmptyState
        icon={FileText}
        heading="No documents"
        body="Upload your first document to get started."
      />,
    );

    expect(screen.getByText('No documents')).toBeInTheDocument();
    expect(screen.getByText('Upload your first document to get started.')).toBeInTheDocument();
  });

  it('renders the icon', () => {
    const { container } = render(
      <EmptyState icon={FileText} heading="No documents" body="Nothing here yet." />,
    );

    // Lucide icons render as <svg> elements
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Primary action
  // ---------------------------------------------------------------------------

  it('renders primary action button', () => {
    render(
      <EmptyState
        icon={FileText}
        heading="No documents"
        body="Nothing here yet."
        primaryAction={{ label: 'Add document' }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add document' })).toBeInTheDocument();
  });

  it('renders primary action with href as a link', () => {
    render(
      <EmptyState
        icon={FileText}
        heading="No documents"
        body="Nothing here yet."
        primaryAction={{ label: 'Add document', href: '/documents/new' }}
      />,
    );

    // Button renders as <a> with role="button" via nativeButton={false}
    const button = screen.getByRole('button', { name: 'Add document' });
    expect(button).toHaveAttribute('href', '/documents/new');
    expect(button.tagName).toBe('A');
  });

  it('calls onClick handler when primary action button is clicked', async () => {
    const handleClick = vi.fn();

    const { user } = setup(
      <EmptyState
        icon={FileText}
        heading="No documents"
        body="Nothing here yet."
        primaryAction={{ label: 'Add document', onClick: handleClick }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add document' }));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  // ---------------------------------------------------------------------------
  // Secondary action
  // ---------------------------------------------------------------------------

  it('renders secondary action with outline variant', () => {
    render(
      <EmptyState
        icon={FileText}
        heading="No documents"
        body="Nothing here yet."
        secondaryAction={{ label: 'Learn more', href: '/docs' }}
      />,
    );

    const button = screen.getByRole('button', { name: 'Learn more' });
    expect(button).toHaveAttribute('href', '/docs');
  });

  it('renders both primary and secondary actions together', () => {
    render(
      <EmptyState
        icon={FileText}
        heading="No documents"
        body="Nothing here yet."
        primaryAction={{ label: 'Add document' }}
        secondaryAction={{ label: 'Learn more' }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add document' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Learn more' })).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Prerequisite override
  // ---------------------------------------------------------------------------

  it('shows prerequisiteAction instead of primaryAction when prerequisiteMissing is true', () => {
    render(
      <EmptyState
        icon={FileText}
        heading="No invoices"
        body="Create a contractor first."
        primaryAction={{ label: 'Create invoice' }}
        prerequisiteAction={{ label: 'Add contractor', href: '/contractors/new' }}
        prerequisiteMissing={true}
      />,
    );

    const button = screen.getByRole('button', { name: 'Add contractor' });
    expect(button).toHaveAttribute('href', '/contractors/new');
    expect(screen.queryByText('Create invoice')).not.toBeInTheDocument();
  });

  it('shows primaryAction when prerequisiteMissing is false', () => {
    render(
      <EmptyState
        icon={FileText}
        heading="No invoices"
        body="Create your first invoice."
        primaryAction={{ label: 'Create invoice' }}
        prerequisiteAction={{ label: 'Add contractor', href: '/contractors/new' }}
        prerequisiteMissing={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Create invoice' })).toBeInTheDocument();
    expect(screen.queryByText('Add contractor')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // No actions
  // ---------------------------------------------------------------------------

  it('does not render actions section when no actions are provided', () => {
    const { container } = render(
      <EmptyState icon={FileText} heading="Nothing here" body="There are no items." />,
    );

    expect(container.querySelector('button')).not.toBeInTheDocument();
    expect(container.querySelector('a')).not.toBeInTheDocument();
  });
});
