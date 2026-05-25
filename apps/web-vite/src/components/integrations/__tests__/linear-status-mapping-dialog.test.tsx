/**
 * Tests target the view component (`LinearStatusMappingDialogView`) directly
 * with shaped props matching the hook return type. Avoids tRPC mocking.
 */

import type * as React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen, setup } from '@/test/test-utils';
import type { LinearStatusMappingDialogViewProps } from '../linear-status-mapping-dialog';
import { LinearStatusMappingDialogView } from '../linear-status-mapping-dialog';

vi.mock('@contractor-ops/ui/components/shadcn/select', () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <select
      aria-label="select"
      value={value ?? ''}
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

const mockTeams = [
  {
    id: 'team-1',
    name: 'Engineering',
    key: 'ENG',
    states: [
      { id: 's-1', name: 'Todo', type: 'unstarted', color: '#aaa', position: 1 },
      { id: 's-2', name: 'In Progress', type: 'started', color: '#bbb', position: 2 },
      { id: 's-3', name: 'Done', type: 'completed', color: '#ccc', position: 3 },
    ],
  },
];

interface BuildOpts {
  open?: boolean;
  selectedTeamId?: string | null;
  teams?: typeof mockTeams;
  teamStates?: (typeof mockTeams)[number]['states'];
  hasChanges?: boolean;
  mappedIds?: Record<string, string>;
  isSavePending?: boolean;
  teamsLoading?: boolean;
  mappingLoading?: boolean;
  onOpenChange?: (open: boolean) => void;
  handleSave?: () => void;
  handleStateSelect?: (workflowStatus: string, stateId: string) => void;
  setSelectedTeamId?: Dispatch<SetStateAction<string | null>>;
}

function buildProps(overrides: BuildOpts = {}): LinearStatusMappingDialogViewProps {
  const {
    open = true,
    selectedTeamId = null,
    teams = mockTeams,
    teamStates = selectedTeamId ? (mockTeams[0]?.states ?? []) : [],
    hasChanges = false,
    mappedIds = {},
    isSavePending = false,
    teamsLoading = false,
    mappingLoading = false,
    onOpenChange = vi.fn(),
    handleSave = vi.fn(),
    handleStateSelect = vi.fn(),
    setSelectedTeamId = vi.fn(),
  } = overrides;

  const selectedTeam = teams.find(tm => tm.id === selectedTeamId);

  const t = ((key: string, values?: Record<string, string>): string => {
    const messages: Record<string, string> = {
      title: 'Linear Status Mapping',
      description: `Map workflow task statuses to Linear workflow states for ${values?.teamName ?? ''}.`,
      selectTeam: 'Select a Linear team',
      noTeams: 'No Linear teams found',
      noTeamsBody: 'Connect a Linear workspace with at least one team to configure mapping.',
      workflowStatus: 'Workflow Status',
      linearState: 'Linear State',
      unmappedTooltip: 'Not mapped — status changes for this state will be ignored',
      discard: 'Discard',
      save: 'Save',
      saving: 'Saving...',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  const tI = ((key: string): string => {
    const messages: Record<string, string> = {
      notMapped: 'Not mapped',
      'workflowStatus.todo': 'To Do',
      'workflowStatus.inProgress': 'In Progress',
      'workflowStatus.done': 'Done',
      'workflowStatus.blocked': 'Blocked',
      'workflowStatus.skipped': 'Skipped',
      'workflowStatus.cancelled': 'Cancelled',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  return {
    open,
    onOpenChange,
    selectedTeamId,
    setSelectedTeamId,
    teamsQuery: { isLoading: teamsLoading, data: teams } as never,
    teams,
    existingMappingQuery: { isLoading: mappingLoading, data: [] } as never,
    selectedTeam,
    hasChanges,
    handleStateSelect,
    handleSave,
    getMappedStateId: (ws: string) => mappedIds[ws],
    saveMutation: { isPending: isSavePending } as never,
    teamStates,
    t,
    tI,
  };
}

describe('LinearStatusMappingDialogView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog title when open', () => {
    render(<LinearStatusMappingDialogView {...buildProps()} />);
    expect(screen.getByText('Linear Status Mapping')).toBeInTheDocument();
  });

  it('shows the empty-teams hint when teams list is empty', () => {
    render(<LinearStatusMappingDialogView {...buildProps({ teams: [] })} />);
    expect(screen.getByText('No Linear teams found')).toBeInTheDocument();
  });

  it('renders save and discard buttons', () => {
    render(<LinearStatusMappingDialogView {...buildProps()} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  });

  it('save is disabled without team selection', () => {
    render(<LinearStatusMappingDialogView {...buildProps()} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('save is enabled when team selected and hasChanges is true', () => {
    render(
      <LinearStatusMappingDialogView
        {...buildProps({ selectedTeamId: 'team-1', hasChanges: true })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('discard button calls onOpenChange(false)', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(<LinearStatusMappingDialogView {...buildProps({ onOpenChange })} />);
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('mapping table not rendered without a team selection', () => {
    render(<LinearStatusMappingDialogView {...buildProps()} />);
    expect(screen.queryByText('Workflow Status')).not.toBeInTheDocument();
  });

  it('renders the mapping table once a team is selected with states', () => {
    render(<LinearStatusMappingDialogView {...buildProps({ selectedTeamId: 'team-1' })} />);
    expect(screen.getByText('Workflow Status')).toBeInTheDocument();
    expect(screen.getByText('Linear State')).toBeInTheDocument();
  });

  it('renders all six workflow status labels with selected team', () => {
    render(<LinearStatusMappingDialogView {...buildProps({ selectedTeamId: 'team-1' })} />);
    expect(screen.getByText('To Do')).toBeInTheDocument();
    // "In Progress" + "Done" exist both as row labels and as Linear state names.
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Done').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Skipped')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('renders interpolated description with team name when selected', () => {
    render(<LinearStatusMappingDialogView {...buildProps({ selectedTeamId: 'team-1' })} />);
    expect(screen.getByText(/for Engineering/)).toBeInTheDocument();
  });

  it('handleStateSelect is called when a per-row select changes', async () => {
    const handleStateSelect = vi.fn();
    const { user } = setup(
      <LinearStatusMappingDialogView
        {...buildProps({ selectedTeamId: 'team-1', handleStateSelect })}
      />,
    );
    const selects = screen.getAllByLabelText('select');
    // Index 0 = team select; index 1 = first workflow status row.
    await user.selectOptions(selects[1] as HTMLSelectElement, 's-1');
    expect(handleStateSelect).toHaveBeenCalledWith('TODO', 's-1');
  });

  it('handleSave is invoked when save clicked', async () => {
    const handleSave = vi.fn();
    const { user } = setup(
      <LinearStatusMappingDialogView
        {...buildProps({ selectedTeamId: 'team-1', hasChanges: true, handleSave })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('shows "Saving..." label while save is in flight', () => {
    render(
      <LinearStatusMappingDialogView
        {...buildProps({ selectedTeamId: 'team-1', hasChanges: true, isSavePending: true })}
      />,
    );
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('does not render dialog content when closed', () => {
    render(<LinearStatusMappingDialogView {...buildProps({ open: false })} />);
    expect(screen.queryByText('Linear Status Mapping')).not.toBeInTheDocument();
  });
});
