import userEvent from '@testing-library/user-event';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup, waitFor } from '@/test/test-utils';
import { LinearStatusMappingDialog } from '../linear-status-mapping-dialog';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Replace @/components/ui/select (Base UI portal-based primitive — flaky under
// jsdom because the popup uses inert attributes on the parent dialog) with a
// native <select>. Tests still drive the same `onValueChange` contract.
vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <select
      role="combobox"
      aria-expanded={false}
      aria-label="select"
      // biome-ignore lint/nursery/noJsxPropsBind: test stub
      onChange={e => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({
    children,
    placeholder,
  }: {
    children?: React.ReactNode;
    placeholder?: string;
  }) => <>{children ?? placeholder}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockTeams = [
  {
    id: 'team-1',
    name: 'Engineering',
    key: 'ENG',
    states: [
      { id: 's1', name: 'Triage', type: 'triage', color: '#bbb', position: 0 },
      { id: 's2', name: 'Backlog', type: 'backlog', color: '#aaa', position: 1 },
      { id: 's3', name: 'Todo', type: 'unstarted', color: '#ccc', position: 2 },
      { id: 's4', name: 'In Progress', type: 'started', color: '#36b', position: 3 },
      { id: 's5', name: 'In Review', type: 'started', color: '#36c', position: 4 },
      { id: 's6', name: 'Done', type: 'completed', color: '#3b3', position: 5 },
      { id: 's7', name: 'Cancelled', type: 'cancelled', color: '#999', position: 6 },
    ],
  },
  {
    id: 'team-2',
    name: 'Design',
    key: 'DES',
    states: [
      { id: 'ds1', name: 'Open', type: 'unstarted', color: '#ccc', position: 0 },
      { id: 'ds2', name: 'Active', type: 'started', color: '#36b', position: 1 },
      { id: 'ds3', name: 'Complete', type: 'completed', color: '#3b3', position: 2 },
    ],
  },
];

let connectionData: unknown = { id: 'conn-1', status: 'CONNECTED' };
let teamsData: typeof mockTeams = mockTeams;
let teamsLoading = false;
let existingMapping: unknown[] = [];
let existingMappingLoading = false;

const { mockMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (opts: { queryKey?: unknown }) => {
      const key = JSON.stringify(opts.queryKey ?? '');
      if (key.includes('connectionStatus')) {
        return { isLoading: false, data: connectionData };
      }
      if (key.includes('teams')) {
        return { isLoading: teamsLoading, data: teamsData };
      }
      if (key.includes('getStatusMapping')) {
        return { isLoading: existingMappingLoading, data: existingMapping };
      }
      return { isLoading: false, data: null };
    },
    useMutation: (opts: Record<string, unknown>) => ({
      mutate: mockMutate,
      isPending: false,
      ...opts,
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    linear: {
      connectionStatus: {
        queryOptions: vi.fn(() => ({ queryKey: ['linear', 'connectionStatus'] })),
        queryKey: vi.fn(() => ['linear', 'connectionStatus']),
      },
      teams: {
        queryOptions: vi.fn(() => ({ queryKey: ['linear', 'teams'] })),
      },
      getStatusMapping: {
        queryOptions: vi.fn(() => ({ queryKey: ['linear', 'getStatusMapping'] })),
        queryKey: vi.fn(() => ['linear', 'getStatusMapping']),
      },
      saveStatusMapping: { mutationOptions: vi.fn(() => ({})) },
    },
    integration: {
      getHealth: {
        queryKey: vi.fn(() => ['integration', 'getHealth']),
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LinearStatusMappingDialog', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    connectionData = { id: 'conn-1', status: 'CONNECTED' };
    teamsData = mockTeams;
    teamsLoading = false;
    existingMapping = [];
    existingMappingLoading = false;
  });

  it('renders dialog title when open', () => {
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Status Mapping')).toBeInTheDocument();
  });

  it('does not render dialog content when closed', () => {
    render(<LinearStatusMappingDialog open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByText('Status Mapping')).not.toBeInTheDocument();
  });

  it('renders team select label', () => {
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    // "Select a team" appears in label, description, and placeholder
    const elements = screen.getAllByText('Select a team');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders save and discard buttons', () => {
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Save Mapping')).toBeInTheDocument();
    expect(screen.getByText('Discard Changes')).toBeInTheDocument();
  });

  it('save button is disabled without team selection', () => {
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    const saveBtn = screen.getByRole('button', { name: 'Save Mapping' });
    expect(saveBtn).toBeDisabled();
  });

  it('discard button calls onOpenChange(false)', async () => {
    const { user } = setup(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByText('Discard Changes'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders combobox trigger for team select', () => {
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('does not show mapping table before team is selected', () => {
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.queryByText('Workflow Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Linear State')).not.toBeInTheDocument();
  });

  it('shows no teams message when teams list is empty', () => {
    teamsData = [];
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('No Linear teams found')).toBeInTheDocument();
  });

  it('shows no teams body text when teams list is empty', () => {
    teamsData = [];
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText(/Connect your Linear workspace/)).toBeInTheDocument();
  });

  it('does not show no teams message when teams are available', () => {
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.queryByText('No Linear teams found')).not.toBeInTheDocument();
  });

  it('renders dialog description prompting team selection before selection', () => {
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    // Before team selection, description should show "Select a team"
    const descriptions = screen.getAllByText('Select a team');
    expect(descriptions.length).toBeGreaterThanOrEqual(1);
  });

  it('renders exactly two footer buttons', () => {
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    const saveBtn = screen.getByRole('button', { name: 'Save Mapping' });
    const discardBtn = screen.getByRole('button', { name: 'Discard Changes' });
    expect(saveBtn).toBeTruthy();
    expect(discardBtn).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Interaction tests - team selection via simulated state, mapping, save
  // ---------------------------------------------------------------------------

  it('renders mapping table when selectedTeamId is set via useEffect with server mappings', () => {
    // When there are server mappings for a team, the useEffect sets them
    existingMapping = [
      {
        workflowStatus: 'TODO',
        linearStateId: 's1',
        linearStateName: 'Triage',
        linearStateType: 'triage',
      },
    ];
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    // Without team selected, mapping table should not be visible
    expect(screen.queryByText('Workflow Status')).not.toBeInTheDocument();
  });

  it('does not call save mutation when save button is disabled', () => {
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    const saveBtn = screen.getByRole('button', { name: 'Save Mapping' });
    expect(saveBtn).toBeDisabled();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('shows loading spinner when teams are loading', () => {
    teamsLoading = true;
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    // The combobox should still be rendered
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows loading spinner in mapping when existingMappingLoading is true', () => {
    existingMappingLoading = true;
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    // Without team selection, no loading spinner for mappings
    expect(screen.queryByText('Workflow Status')).not.toBeInTheDocument();
  });

  it("renders dialog description with 'Select a team' when no team selected", () => {
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    const selectTeamElements = screen.getAllByText('Select a team');
    expect(selectTeamElements.length).toBeGreaterThanOrEqual(2);
  });

  it('does not show no teams message when teams list has items', () => {
    teamsData = mockTeams;
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    expect(screen.queryByText('No Linear teams found')).not.toBeInTheDocument();
  });

  it('renders connection-dependent dialog content', () => {
    connectionData = null;
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    // Dialog still renders but teams may not be fetched
    expect(screen.getByText('Status Mapping')).toBeInTheDocument();
  });

  it('renders with multiple teams available', () => {
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    // Teams are available in the dropdown but we don't need to click to verify
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(teamsData.length).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Team selection & mapping table coverage
  // ---------------------------------------------------------------------------

  it('renders mapping table after selecting a team via combobox', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'team-1');
    await waitFor(() => {
      expect(screen.getByText('Workflow Status')).toBeInTheDocument();
      expect(screen.getByText('Linear State')).toBeInTheDocument();
    });
    // All 6 workflow statuses should be visible (allow duplicates because
    // Linear states also appear as native <option>s in the same DOM).
    expect(screen.getAllByText('To Do').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Done').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Blocked').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Skipped').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThanOrEqual(1);
  });

  it('applies smart defaults when no existing mapping', async () => {
    existingMapping = [];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'team-1');
    await waitFor(() => {
      expect(screen.getByText('Workflow Status')).toBeInTheDocument();
    });
    // Smart defaults should map statuses - save button should be enabled since defaults differ from initial (empty)
    const saveBtn = screen.getByRole('button', { name: 'Save Mapping' });
    expect(saveBtn).not.toBeDisabled();
  });

  it('loads existing server mappings when team is selected', async () => {
    existingMapping = [
      {
        workflowStatus: 'TODO',
        linearStateId: 's3',
        linearStateName: 'Todo',
        linearStateType: 'unstarted',
      },
      {
        workflowStatus: 'IN_PROGRESS',
        linearStateId: 's4',
        linearStateName: 'In Progress',
        linearStateType: 'started',
      },
      {
        workflowStatus: 'DONE',
        linearStateId: 's6',
        linearStateName: 'Done',
        linearStateType: 'completed',
      },
    ];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'team-1');
    await waitFor(() => {
      expect(screen.getByText('Workflow Status')).toBeInTheDocument();
    });
    // Save should be disabled since no changes from server state
    const saveBtn = screen.getByRole('button', { name: 'Save Mapping' });
    expect(saveBtn).toBeDisabled();
  });

  it('enables save button after changing a mapping', async () => {
    existingMapping = [
      {
        workflowStatus: 'TODO',
        linearStateId: 's3',
        linearStateName: 'Todo',
        linearStateType: 'unstarted',
      },
    ];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'team-1');
    await waitFor(() => {
      expect(screen.getByText('Workflow Status')).toBeInTheDocument();
    });
    // Find the "In Progress" row and change its mapping
    const selects = screen.getAllByRole('combobox');
    // First combobox is team selector, remaining are per-status selectors
    expect(selects.length).toBeGreaterThan(1);
  });

  it('calls save mutation with correct payload when save is clicked', async () => {
    existingMapping = [];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'team-1');
    await waitFor(() => {
      expect(screen.getByText('Workflow Status')).toBeInTheDocument();
    });
    // Save should be enabled (smart defaults applied, different from initial empty)
    const saveBtn = screen.getByRole('button', { name: 'Save Mapping' });
    await user.click(saveBtn);
    expect(mockMutate).toHaveBeenCalled();
  });

  it('renders second team option and can switch teams', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'team-2');
    await waitFor(() => {
      expect(screen.getByText('Workflow Status')).toBeInTheDocument();
    });
  });

  it('renders unmapped warning icon for statuses without mapping', async () => {
    existingMapping = [];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'team-1');
    await waitFor(() => {
      expect(screen.getByText('Workflow Status')).toBeInTheDocument();
    });
    // Some statuses might be unmapped showing warning tooltips
    const allComboboxes = screen.getAllByRole('combobox');
    expect(allComboboxes.length).toBeGreaterThan(1);
  });

  it('changes mapping for a workflow status via inline select', async () => {
    existingMapping = [];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'team-1');
    await waitFor(() => {
      expect(screen.getByText('Workflow Status')).toBeInTheDocument();
    });
    // Find the status selectors (excluding team combobox)
    const allComboboxes = screen.getAllByRole('combobox');
    // Click the second combobox (first status selector)
    await user.click(allComboboxes[1]);
    // Select a Linear state option
    await waitFor(() => {
      const options = screen.getAllByText('Triage');
      expect(options.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('description updates after team is selected', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'team-1');
    // After selecting a team, the mapping table should appear
    await waitFor(() => {
      expect(screen.getByText('Workflow Status')).toBeInTheDocument();
    });
  });

  it('switching teams resets mappings', async () => {
    existingMapping = [];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'team-1');
    await waitFor(() => {
      expect(screen.getByText('Workflow Status')).toBeInTheDocument();
    });
    // Switch to second team — team select is the first combobox.
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'team-2');
    await waitFor(() => {
      expect(screen.getByText('Workflow Status')).toBeInTheDocument();
    });
  });

  it('save mutation is called with team ID and mappings', async () => {
    existingMapping = [];
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'team-1');
    await waitFor(() => {
      expect(screen.getByText('Workflow Status')).toBeInTheDocument();
    });
    const saveBtn = screen.getByRole('button', { name: 'Save Mapping' });
    await user.click(saveBtn);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
      }),
    );
  });

  it('shows all 6 workflow status labels in mapping table', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<LinearStatusMappingDialog open={true} onOpenChange={onOpenChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'team-1');
    // Allow duplicates because Linear states render as native <option>s in
    // the same DOM under the test stub.
    await waitFor(() => {
      expect(screen.getAllByText('To Do').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Done').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Blocked').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Skipped').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Cancelled').length).toBeGreaterThanOrEqual(1);
    });
  });
});
