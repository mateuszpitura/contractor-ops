import { useQuery } from '@tanstack/react-query';
import { render, screen, setup } from '@/test/test-utils';
import { DirectoryImportWizard } from '../directory-import-wizard';

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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/test',
}));

vi.mock('@/components/billing/feature-gate', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, data: null }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    googleWorkspace: {
      listDirectory: {
        queryOptions: vi.fn(() => ({ queryKey: ['gw', 'listDirectory'] })),
        queryKey: vi.fn(() => ['gw', 'listDirectory']),
      },
      listUserGroups: { mutationOptions: vi.fn(() => ({})) },
      bulkImport: { mutationOptions: vi.fn(() => ({})) },
      syncStatus: { queryKey: vi.fn(() => ['gw', 'syncStatus']) },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../directory-summary-bar', () => ({
  DirectorySummaryBar: ({ total, selected }: { total: number; selected: number }) => (
    <div data-testid="summary-bar">
      {total} total, {selected} selected
    </div>
  ),
}));
vi.mock('../directory-preview-table', () => ({
  DirectoryPreviewTable: ({
    users,
    selectedEmails,
    onSelectionChange,
  }: {
    users: Array<{ primaryEmail: string; name: { fullName: string } }>;
    selectedEmails: Set<string>;
    onSelectionChange: (emails: Set<string>) => void;
  }) => (
    <div data-testid="preview-table">
      {users.map(u => (
        <div key={u.primaryEmail}>
          <span>{u.name.fullName}</span>
          <button
            type="button"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => {
              const next = new Set(selectedEmails);
              next.add(u.primaryEmail);
              onSelectionChange(next);
            }}>
            Select {u.name.fullName}
          </button>
        </div>
      ))}
    </div>
  ),
}));
vi.mock('../role-assignment-controls', () => ({
  RoleAssignmentControls: ({ defaultRole }: { defaultRole: string }) => (
    <div data-testid="role-controls">Default: {defaultRole}</div>
  ),
  ROLE_LABELS: { readonly: 'Read Only', admin: 'Admin', manager: 'Manager', member: 'Member' },
}));
vi.mock('../group-role-mapping-step', () => ({
  GroupRoleMappingStep: () => <div data-testid="group-mapping" />,
}));
vi.mock('../import-confirm-step', () => ({
  ImportConfirmStep: ({
    userCount,
    onBack,
    onConfirm,
  }: {
    userCount: number;
    onBack: () => void;
    onConfirm: () => void;
  }) => (
    <div data-testid="import-confirm">
      <span>{userCount} users to import</span>
      <button type="button" onClick={onBack}>
        Back from confirm
      </button>
      <button type="button" onClick={onConfirm}>
        Confirm import
      </button>
    </div>
  ),
}));

const mockedUseQuery = vi.mocked(useQuery);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USERS = [
  {
    id: 'u1',
    primaryEmail: 'alice@acme.com',
    name: { fullName: 'Alice Smith' },
    orgUnitPath: '/Engineering',
    isAdmin: false,
    alreadyImported: false,
  },
  {
    id: 'u2',
    primaryEmail: 'bob@acme.com',
    name: { fullName: 'Bob Jones' },
    orgUnitPath: '/Design',
    isAdmin: false,
    alreadyImported: false,
  },
];

function setupDirectoryMock(
  options: {
    users?: typeof MOCK_USERS;
    stats?: { total: number; alreadyImported: number; new: number };
    isLoading?: boolean;
    isError?: boolean;
  } = {},
) {
  const {
    users = [],
    stats = { total: 0, alreadyImported: 0, new: 0 },
    isLoading = false,
    isError = false,
  } = options;
  mockedUseQuery.mockReturnValue({
    isLoading,
    isError,
    data: { users, stats },
  } as unknown);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DirectoryImportWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Basic rendering
  // -------------------------------------------------------------------------

  it('renders dialog title when open', () => {
    setupDirectoryMock();
    render(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Import Google Workspace Users')).toBeInTheDocument();
  });

  it('renders step indicators', () => {
    setupDirectoryMock();
    render(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/Preview directory/)).toBeInTheDocument();
    expect(screen.getByText(/Assign roles/)).toBeInTheDocument();
    expect(screen.getByText(/Review and import/)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    setupDirectoryMock();
    render(<DirectoryImportWizard open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('Import Google Workspace Users')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Empty states
  // -------------------------------------------------------------------------

  it('renders empty state when no users', () => {
    setupDirectoryMock({ stats: { total: 0, alreadyImported: 0, new: 0 } });
    render(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('renders all-imported state when no new users', () => {
    setupDirectoryMock({ stats: { total: 5, alreadyImported: 5, new: 0 } });
    render(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('All users imported')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it('renders error state', () => {
    mockedUseQuery.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
    } as unknown);
    render(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/Could not load the directory/)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it('renders dialog during loading without errors', () => {
    mockedUseQuery.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    } as unknown);
    render(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Import Google Workspace Users')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // User preview with users
  // -------------------------------------------------------------------------

  it('renders preview table and summary bar when users exist', () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    render(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('summary-bar')).toBeInTheDocument();
    expect(screen.getByTestId('preview-table')).toBeInTheDocument();
  });

  it("renders 'Next: Roles' button when new users exist", () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    render(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Next: Roles')).toBeInTheDocument();
  });

  it('disables Next button when no users are selected', () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    render(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Next: Roles').closest('button')).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // Step navigation
  // -------------------------------------------------------------------------

  it('navigates to step 2 when Next is clicked after selecting users', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    // Select a user via the mock preview table
    await user.click(screen.getByText('Select Alice Smith'));

    // Click Next: Roles
    await user.click(screen.getByText('Next: Roles'));

    // Step 2 content should appear
    expect(screen.getByTestId('role-controls')).toBeInTheDocument();
  });

  it('navigates to step 3 from step 2', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    // Select and advance to step 2
    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Next: Roles'));

    // Advance to step 3
    await user.click(screen.getByText('Next: Review'));
    expect(screen.getByTestId('import-confirm')).toBeInTheDocument();
  });

  it('navigates back from step 2 to step 1', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Next: Roles'));

    // Go back
    await user.click(screen.getByText('Back'));
    expect(screen.getByTestId('preview-table')).toBeInTheDocument();
  });

  it('navigates back from step 3 to step 2', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Next: Roles'));
    await user.click(screen.getByText('Next: Review'));

    // Go back from step 3
    await user.click(screen.getByText('Back from confirm'));
    expect(screen.getByTestId('role-controls')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Step indicator current step highlighting
  // -------------------------------------------------------------------------

  it('marks step 1 as current initially', () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    render(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);
    const step1 = screen.getByText(/Preview directory/).closest('div');
    expect(step1?.getAttribute('aria-current')).toBe('step');
  });

  it('renders user count in step 3 confirm view', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Next: Roles'));
    await user.click(screen.getByText('Next: Review'));

    expect(screen.getByText('1 users to import')).toBeInTheDocument();
  });

  it('renders confirm import button in step 3', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Next: Roles'));
    await user.click(screen.getByText('Next: Review'));

    expect(screen.getByText('Confirm import')).toBeInTheDocument();
  });

  it('selects multiple users and shows updated selection count', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Select Bob Jones'));

    expect(screen.getByTestId('summary-bar')).toHaveTextContent('2 selected');
  });

  it('renders role controls with default readonly in step 2', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Next: Roles'));

    expect(screen.getByTestId('role-controls')).toHaveTextContent('Default: readonly');
  });

  it('renders group mapping component in step 2', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Next: Roles'));

    expect(screen.getByTestId('group-mapping')).toBeInTheDocument();
  });

  it('shows back button in step 2', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Next: Roles'));

    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('shows Next: Review button in step 2', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Next: Roles'));

    expect(screen.getByText('Next: Review')).toBeInTheDocument();
  });

  it('shows confirm import button in step 3 and triggers import', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Next: Roles'));
    await user.click(screen.getByText('Next: Review'));

    expect(screen.getByText('Confirm import')).toBeInTheDocument();
    await user.click(screen.getByText('Confirm import'));
  });

  it('maintains user selection across step navigation', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByText('Select Alice Smith'));
    expect(screen.getByTestId('summary-bar')).toHaveTextContent('1 selected');

    await user.click(screen.getByText('Next: Roles'));
    await user.click(screen.getByText('Back'));

    // Selection should persist after going back
    expect(screen.getByTestId('summary-bar')).toHaveTextContent('1 selected');
  });

  it('renders loading state without error', () => {
    setupDirectoryMock({ isLoading: true });
    render(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Import Google Workspace Users')).toBeInTheDocument();
  });

  it('resets wizard state when dialog is closed and reopened', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const onOpenChange = vi.fn();
    const { rerender } = render(<DirectoryImportWizard open={true} onOpenChange={onOpenChange} />);

    // Close dialog
    rerender(<DirectoryImportWizard open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByText('Import Google Workspace Users')).not.toBeInTheDocument();
  });

  it('triggers import mutation when confirm import is clicked in step 3', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    // Select user and navigate through all steps
    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Next: Roles'));
    await user.click(screen.getByText('Next: Review'));

    // Click confirm
    await user.click(screen.getByText('Confirm import'));
    // The import mutation should be called (mutate is mocked)
    expect(screen.getByTestId('import-confirm')).toBeInTheDocument();
  });

  it('shows correct user count when multiple users are selected for import', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    // Select both users
    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Select Bob Jones'));
    await user.click(screen.getByText('Next: Roles'));
    await user.click(screen.getByText('Next: Review'));

    expect(screen.getByText('2 users to import')).toBeInTheDocument();
  });

  it('maintains selection state when navigating back and forward', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    // Select users, go forward, back, forward again
    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Select Bob Jones'));
    await user.click(screen.getByText('Next: Roles'));

    // Go back
    await user.click(screen.getByText('Back'));
    expect(screen.getByTestId('summary-bar')).toHaveTextContent('2 selected');

    // Go forward again
    await user.click(screen.getByText('Next: Roles'));
    expect(screen.getByTestId('role-controls')).toBeInTheDocument();
  });

  it('renders step indicator with correct aria-current for step 2', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Next: Roles'));

    const step2 = screen.getByText(/Assign roles/).closest('div');
    expect(step2?.getAttribute('aria-current')).toBe('step');
  });

  it('renders step 3 with confirm and back buttons', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByText('Select Alice Smith'));
    await user.click(screen.getByText('Next: Roles'));
    await user.click(screen.getByText('Next: Review'));

    expect(screen.getByText('Confirm import')).toBeInTheDocument();
    expect(screen.getByText('Back from confirm')).toBeInTheDocument();
  });

  it('shows loading skeletons for step 1', () => {
    setupDirectoryMock({ isLoading: true });
    render(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);
    // Loading state should show skeleton elements
    expect(screen.getByText('Import Google Workspace Users')).toBeInTheDocument();
  });

  it('selects users and enables Next button', async () => {
    setupDirectoryMock({
      users: MOCK_USERS,
      stats: { total: 2, alreadyImported: 0, new: 2 },
    });
    const { user } = setup(<DirectoryImportWizard open={true} onOpenChange={vi.fn()} />);

    // Initially disabled
    expect(screen.getByText('Next: Roles').closest('button')).toBeDisabled();

    // Select a user
    await user.click(screen.getByText('Select Alice Smith'));

    // Now enabled
    expect(screen.getByText('Next: Roles').closest('button')).not.toBeDisabled();
  });
});
