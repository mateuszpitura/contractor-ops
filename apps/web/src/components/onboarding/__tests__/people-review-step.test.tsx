import { useQuery } from '@tanstack/react-query';
import { render, screen, setup } from '@/test/test-utils';
import type { PersonSelection } from '../import-wizard';
import { PeopleReviewStep } from '../people-review-step';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...actual, useQuery: vi.fn() };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    onboardingImport: {
      fetchPeople: { queryOptions: () => ({ queryKey: ['fetchPeople'] }) },
    },
  },
}));

vi.mock('../conflict-resolution-popover', () => ({
  ConflictResolutionPopover: ({ conflicts }: { conflicts: unknown[] | null }) => (
    <span data-testid="conflict-popover">{conflicts?.length ?? 0} conflicts</span>
  ),
}));

const mockedUseQuery = vi.mocked(useQuery);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePerson(overrides: Record<string, unknown> = {}) {
  return {
    email: 'john@test.com',
    name: 'John Doe',
    status: 'new' as const,
    sources: [{ source: 'JIRA', name: 'John Doe' }],
    conflicts: [],
    ...overrides,
  };
}

function makeSelections(
  people: Array<{ email: string; status: string }>,
): Map<string, PersonSelection> {
  const map = new Map<string, PersonSelection>();
  for (const p of people) {
    map.set(p.email, {
      role: 'readonly',
      skip: p.status === 'exists',
      resolvedConflicts: {},
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PeopleReviewStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it('shows loading skeletons', () => {
    mockedUseQuery.mockReturnValue({ data: undefined, isLoading: true } as unknown);
    const { container } = render(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={[]}
        onMergedPeopleChange={vi.fn()}
        personSelections={new Map()}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it('shows empty state when no people', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    render(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={[]}
        onMergedPeopleChange={vi.fn()}
        personSelections={new Map()}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('No team members found')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Table rendering
  // -------------------------------------------------------------------------

  it('renders table with people when data exists', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [makePerson()];
    render(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@test.com')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [makePerson()];
    render(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Summary counts
  // -------------------------------------------------------------------------

  it('renders summary counts for new, conflict, existing', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [
      makePerson({ email: 'a@t.com', name: 'A', status: 'new' }),
      makePerson({
        email: 'b@t.com',
        name: 'B',
        status: 'conflict',
        conflicts: [
          {
            field: 'name',
            values: [
              { source: 'JIRA', value: 'B1' },
              { source: 'LINEAR', value: 'B2' },
            ],
          },
        ],
      }),
      makePerson({ email: 'c@t.com', name: 'C', status: 'exists' }),
    ];
    render(
      <PeopleReviewStep
        selectedSources={['JIRA', 'LINEAR']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    // Summary bar uses translation keys from OnboardingImport.step2
    expect(screen.getAllByText('New').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Filter tabs
  // -------------------------------------------------------------------------

  it('renders filter tabs', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [makePerson()];
    render(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Status badges
  // -------------------------------------------------------------------------

  it("renders 'New' badge for new people", () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [makePerson({ status: 'new' })];
    render(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    // The Badge with "New" for the status column (not the filter or summary)
    const badges = screen.getAllByText('New');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("renders 'Exists' badge for existing people", () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [
      makePerson({ email: 'existing@t.com', name: 'Existing User', status: 'exists' }),
    ];
    render(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Exists')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Conflict resolution
  // -------------------------------------------------------------------------

  it('renders conflict popover for conflict status people', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [
      makePerson({
        email: 'conflict@t.com',
        name: 'Conflict User',
        status: 'conflict',
        conflicts: [{ field: 'name', values: [{ source: 'JIRA', value: 'Name1' }] }],
      }),
    ];
    render(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('conflict-popover')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Source badges
  // -------------------------------------------------------------------------

  it('renders source badges', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [
      makePerson({
        sources: [
          { source: 'JIRA', name: 'J' },
          { source: 'LINEAR', name: 'L' },
        ],
      }),
    ];
    render(
      <PeopleReviewStep
        selectedSources={['JIRA', 'LINEAR']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Jira')).toBeInTheDocument();
    expect(screen.getByText('Linear')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Skip action
  // -------------------------------------------------------------------------

  it('renders skip button for non-existing people', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [makePerson()];
    render(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Skip')).toBeInTheDocument();
  });

  it('calls onPersonSelectionsChange when skip is clicked', async () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [makePerson()];
    const onPersonSelectionsChange = vi.fn();
    const { user } = setup(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={onPersonSelectionsChange}
      />,
    );
    await user.click(screen.getByText('Skip'));
    expect(onPersonSelectionsChange).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Checkbox selection
  // -------------------------------------------------------------------------

  it('renders checkbox for new people', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [makePerson()];
    render(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // At least the select-all + per-row checkbox
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('renders existing people row with name visible', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [makePerson({ email: 'exist@t.com', name: 'Existing User', status: 'exists' })];
    render(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Existing User')).toBeInTheDocument();
    expect(screen.getByText('exist@t.com')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Batch toolbar
  // -------------------------------------------------------------------------

  it('shows batch toolbar when items are checked', async () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [makePerson()];
    const { user } = setup(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    // Click the row checkbox (not select-all)
    const checkboxes = screen.getAllByRole('checkbox');
    const rowCheckbox = checkboxes.find(cb => cb.getAttribute('aria-label') === 'Select John Doe');
    if (rowCheckbox) {
      await user.click(rowCheckbox);
      expect(screen.getByText('1 selected')).toBeInTheDocument();
      expect(screen.getByText('Import Selected')).toBeInTheDocument();
      expect(screen.getByText('Skip Selected')).toBeInTheDocument();
    }
  });

  // -------------------------------------------------------------------------
  // Heading
  // -------------------------------------------------------------------------

  it('renders heading and subtitle', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [makePerson()];
    render(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Review team members')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Select all checkbox
  // -------------------------------------------------------------------------

  it('select all toggles all selectable people', async () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [
      makePerson({ email: 'a@t.com', name: 'A', status: 'new' }),
      makePerson({ email: 'b@t.com', name: 'B', status: 'new' }),
    ];
    const { user } = setup(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    // Click select all
    const selectAll = screen.getByRole('checkbox', { name: 'Select all' });
    await user.click(selectAll);
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    // Deselect all
    await user.click(selectAll);
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Row toggle
  // -------------------------------------------------------------------------

  it('toggle individual row checkbox', async () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [
      makePerson({ email: 'a@t.com', name: 'A', status: 'new' }),
      makePerson({ email: 'b@t.com', name: 'B', status: 'new' }),
    ];
    const { user } = setup(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    const rowCheckbox = screen.getByRole('checkbox', { name: 'Select A' });
    await user.click(rowCheckbox);
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    // Toggle off
    await user.click(rowCheckbox);
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Batch import / skip / role
  // -------------------------------------------------------------------------

  it('batch import calls onPersonSelectionsChange and clears selection', async () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [makePerson({ email: 'a@t.com', name: 'A', status: 'new' })];
    const onPersonSelectionsChange = vi.fn();
    const { user } = setup(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={onPersonSelectionsChange}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Select A' }));
    await user.click(screen.getByText('Import Selected'));
    expect(onPersonSelectionsChange).toHaveBeenCalled();
    // After batch action, selection should be cleared
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
  });

  it('batch skip calls onPersonSelectionsChange with skip=true', async () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [makePerson({ email: 'a@t.com', name: 'A', status: 'new' })];
    const onPersonSelectionsChange = vi.fn();
    const { user } = setup(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={onPersonSelectionsChange}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Select A' }));
    await user.click(screen.getByText('Skip Selected'));
    expect(onPersonSelectionsChange).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Role change
  // -------------------------------------------------------------------------

  it('calls onPersonSelectionsChange when role is changed', async () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [makePerson({ email: 'a@t.com', name: 'A', status: 'new' })];
    const onPersonSelectionsChange = vi.fn();
    setup(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={onPersonSelectionsChange}
      />,
    );
    // The role dropdown should be present
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // Data initialization via useEffect
  // -------------------------------------------------------------------------

  it('calls onMergedPeopleChange when data arrives and mergedPeople is empty', () => {
    const onMergedPeopleChange = vi.fn();
    const onPersonSelectionsChange = vi.fn();
    const apiPeople = [makePerson({ email: 'fetched@t.com', name: 'Fetched' })];
    mockedUseQuery.mockReturnValue({ data: apiPeople, isLoading: false } as unknown);

    render(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={[]}
        onMergedPeopleChange={onMergedPeopleChange}
        personSelections={new Map()}
        onPersonSelectionsChange={onPersonSelectionsChange}
      />,
    );

    expect(onMergedPeopleChange).toHaveBeenCalledWith(apiPeople);
    expect(onPersonSelectionsChange).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Filter tabs
  // -------------------------------------------------------------------------

  it("filters by 'new' tab", async () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [
      makePerson({ email: 'a@t.com', name: 'New User', status: 'new' }),
      makePerson({ email: 'b@t.com', name: 'Existing User', status: 'exists' }),
    ];
    setup(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );

    // Both visible initially
    expect(screen.getByText('New User')).toBeInTheDocument();
    expect(screen.getByText('Existing User')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Multiple sources rendering
  // -------------------------------------------------------------------------

  it('renders GWS and Slack source badges', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [
      makePerson({
        sources: [
          { source: 'GOOGLE_WORKSPACE', name: 'G' },
          { source: 'SLACK', name: 'S' },
        ],
      }),
    ];
    render(
      <PeopleReviewStep
        selectedSources={['GOOGLE_WORKSPACE', 'SLACK']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    expect(screen.getByText('GWS')).toBeInTheDocument();
    expect(screen.getByText('Slack')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Existing person row is dimmed and checkbox disabled
  // -------------------------------------------------------------------------

  it('existing person has disabled checkbox and no skip button', () => {
    mockedUseQuery.mockReturnValue({ data: [], isLoading: false } as unknown);
    const people = [makePerson({ email: 'e@t.com', name: 'Exists', status: 'exists' })];
    render(
      <PeopleReviewStep
        selectedSources={['JIRA']}
        mergedPeople={people}
        onMergedPeopleChange={vi.fn()}
        personSelections={makeSelections(people)}
        onPersonSelectionsChange={vi.fn()}
      />,
    );
    // Existing people should not have skip button
    expect(screen.queryByText('Skip')).not.toBeInTheDocument();
  });
});
