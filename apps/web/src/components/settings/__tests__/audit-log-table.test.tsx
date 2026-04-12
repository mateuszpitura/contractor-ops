import { render, screen } from '@/test/test-utils';
import type { AuditLogEntry } from '../audit-log-table';
import { AuditLogTable } from '../audit-log-table';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
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
});
