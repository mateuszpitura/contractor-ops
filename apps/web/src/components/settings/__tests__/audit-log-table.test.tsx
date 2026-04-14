import { render, screen, setup } from '@/test/test-utils';
import type { AuditLogEntry } from '../audit-log-table';
import { AuditLogTable } from '../audit-log-table';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

const mockEntry: AuditLogEntry = {
  id: 'entry-1',
  organizationId: 'org-1',
  actorType: 'USER',
  actorId: 'u1',
  actorName: 'Alice',
  action: 'CREATE',
  resourceType: 'CONTRACT',
  resourceId: 'c1',
  resourceName: 'Contract A',
  oldValuesJson: null,
  newValuesJson: { status: 'active' },
  metadataJson: { role: 'admin' },
  ipAddress: '1.2.3.4',
  userAgent: 'test',
  createdAt: new Date().toISOString(),
};

describe('AuditLogTable', () => {
  const defaultProps = {
    data: [mockEntry],
    totalCount: 1,
    page: 1,
    pageSize: 25,
    onPageChange: vi.fn(),
    sortOrder: 'desc' as const,
    onSortOrderChange: vi.fn(),
    expandedRows: {},
    onToggleRow: vi.fn(),
  };

  it('renders table headers', () => {
    render(<AuditLogTable {...defaultProps} />);
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Actor')).toBeInTheDocument();
  });

  it('renders actor name', () => {
    render(<AuditLogTable {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders resource name as link for CONTRACT type', () => {
    render(<AuditLogTable {...defaultProps} />);
    expect(screen.getByText('Contract A')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<AuditLogTable {...defaultProps} data={[]} totalCount={0} />);
    expect(screen.getByText('No audit log entries')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading', () => {
    render(<AuditLogTable {...defaultProps} data={[]} isLoading />);
    expect(screen.getByText('Time')).toBeInTheDocument();
  });

  it('renders expand/collapse button for each row', () => {
    render(<AuditLogTable {...defaultProps} />);
    const expandBtn = screen.getByRole('button', { name: /expand/i });
    expect(expandBtn).toBeInTheDocument();
  });

  it('calls onToggleRow when row is clicked', async () => {
    const onToggleRow = vi.fn();
    const { user } = setup(<AuditLogTable {...defaultProps} onToggleRow={onToggleRow} />);
    // Click the table row (not the expand button specifically)
    const row = screen.getByText('Alice').closest('tr');
    if (row) await user.click(row);
    expect(onToggleRow).toHaveBeenCalledWith('entry-1');
  });

  it('calls onSortOrderChange when timestamp header is clicked', async () => {
    const onSortOrderChange = vi.fn();
    const { user } = setup(
      <AuditLogTable {...defaultProps} onSortOrderChange={onSortOrderChange} />,
    );
    const timeHeader = screen.getByText('Time');
    await user.click(timeHeader);
    expect(onSortOrderChange).toHaveBeenCalledWith('asc');
  });

  it('renders pagination when totalCount > 0', () => {
    render(<AuditLogTable {...defaultProps} totalCount={50} pageSize={25} />);
    expect(screen.getByText(/1 of 2/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    render(<AuditLogTable {...defaultProps} totalCount={50} page={1} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('renders refetching overlay when isFetching but not isLoading', () => {
    const { container } = render(
      <AuditLogTable {...defaultProps} isFetching isLoading={false} />,
    );
    // Refetch overlay has a Loader2 spinner
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders role badge in actor column when metadata has role', () => {
    render(<AuditLogTable {...defaultProps} />);
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('renders resource link for CONTRACT type', () => {
    render(<AuditLogTable {...defaultProps} />);
    const link = screen.getByRole('link', { name: 'Contract A' });
    expect(link).toHaveAttribute('href', '/contracts/c1');
  });
});
