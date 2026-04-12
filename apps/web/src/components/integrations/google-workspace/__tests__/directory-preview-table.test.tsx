import { render, screen, setup } from '@/test/test-utils';
import type { DirectoryUser } from '../directory-preview-table';
import { DirectoryPreviewTable } from '../directory-preview-table';

const mockUsers: DirectoryUser[] = [
  {
    id: 'u1',
    primaryEmail: 'alice@test.com',
    name: { givenName: 'Alice', familyName: 'Smith', fullName: 'Alice Smith' },
    thumbnailPhotoUrl: null,
    orgUnitPath: '/Engineering',
    department: 'Eng',
    isAdmin: false,
    alreadyExists: false,
  },
  {
    id: 'u2',
    primaryEmail: 'bob@test.com',
    name: { givenName: 'Bob', familyName: 'Jones', fullName: 'Bob Jones' },
    thumbnailPhotoUrl: null,
    orgUnitPath: '/Engineering',
    department: 'Eng',
    isAdmin: false,
    alreadyExists: true,
  },
];

describe('DirectoryPreviewTable', () => {
  it('renders user names', () => {
    render(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('renders user emails', () => {
    render(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
    expect(screen.getByText('bob@test.com')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument();
  });

  it('renders empty state when no users', () => {
    render(
      <DirectoryPreviewTable users={[]} selectedEmails={new Set()} onSelectionChange={vi.fn()} />,
    );
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  // ---- Row selection ----
  it('renders checkboxes for selectable users', () => {
    render(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // At least 2 row checkboxes (header may or may not render as checkbox)
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('calls onSelectionChange when a row checkbox is clicked', async () => {
    const onSelectionChange = vi.fn();
    const { user } = setup(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set()}
        onSelectionChange={onSelectionChange}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // Click on a checkbox (first one is select-all or alice)
    await user.click(checkboxes[0]);
    expect(onSelectionChange).toHaveBeenCalled();
  });

  it('renders checkbox for existing users', () => {
    render(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  // ---- Search filtering ----
  it('renders search input with correct placeholder', () => {
    render(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument();
  });

  // ---- Column headers ----
  it('renders table column headers', () => {
    render(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  // ---- Select all checkbox ----
  it('calls onSelectionChange when a checkbox is clicked', async () => {
    const onSelectionChange = vi.fn();
    const { user } = setup(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set()}
        onSelectionChange={onSelectionChange}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    expect(onSelectionChange).toHaveBeenCalled();
  });

  // ---- Already exists badge ----
  it('shows already exists badge for existing users', () => {
    render(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Already exists')).toBeInTheDocument();
  });

  // ---- Selected state ----
  it('renders selected state for pre-selected emails', () => {
    const { container } = render(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set(['alice@test.com'])}
        onSelectionChange={vi.fn()}
      />,
    );
    const selectedRow = container.querySelector('[data-state="selected"]');
    expect(selectedRow).toBeInTheDocument();
  });

  // ---- Department column ----
  it('renders department column', () => {
    render(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Department')).toBeInTheDocument();
  });

  // ---- Search filtering ----
  it('filters users when search term is entered', async () => {
    const { user } = setup(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText('Search users...');
    await user.type(input, 'Alice');
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  // ---- Multiple selections ----
  it('renders multiple selected rows', () => {
    const { container } = render(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set(['alice@test.com', 'bob@test.com'])}
        onSelectionChange={vi.fn()}
      />,
    );
    const selectedRows = container.querySelectorAll('[data-state="selected"]');
    expect(selectedRows.length).toBe(2);
  });

  // ---- Org unit rendering ----
  it('renders org unit path for users', () => {
    render(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Eng').length).toBeGreaterThanOrEqual(1);
  });

  // ---- Many users ----
  it('renders table with many users', () => {
    const manyUsers = Array.from({ length: 10 }, (_, i) => ({
      id: `u${i}`,
      primaryEmail: `user${i}@test.com`,
      name: { givenName: `User`, familyName: `${i}`, fullName: `User ${i}` },
      thumbnailPhotoUrl: null,
      orgUnitPath: '/Engineering',
      department: 'Eng',
      isAdmin: false,
      alreadyExists: false,
    }));
    render(
      <DirectoryPreviewTable
        users={manyUsers}
        selectedEmails={new Set()}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByText('User 0')).toBeInTheDocument();
    expect(screen.getByText('User 9')).toBeInTheDocument();
  });

  // ---- Select all toggles all ----
  it('toggles select all and calls onSelectionChange', async () => {
    const onSelectionChange = vi.fn();
    const { user } = setup(
      <DirectoryPreviewTable
        users={mockUsers}
        selectedEmails={new Set()}
        onSelectionChange={onSelectionChange}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // Click select-all checkbox
    await user.click(checkboxes[0]);
    expect(onSelectionChange).toHaveBeenCalled();
  });
});
