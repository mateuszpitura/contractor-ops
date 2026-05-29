/**
 * Tests target `LinearTaskConfigView` with shaped props. Renders null when not
 * connected; otherwise shows the enable toggle, team summary, and team select.
 */

import type * as React from 'react';
import { useCallback } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import { LinearTaskConfigView } from '../linear-task-config';

function MockSelect({
  children,
  onValueChange,
  value,
}: {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (v: string) => void;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange?.(e.target.value),
    [onValueChange],
  );
  return (
    <select aria-label="select" value={value ?? ''} onChange={handleChange}>
      {children}
    </select>
  );
}

vi.mock('@contractor-ops/ui/components/shadcn/select', () => ({
  Select: MockSelect,
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
  { id: 'team-1', name: 'Engineering', key: 'ENG' },
  { id: 'team-2', name: 'Design', key: 'DSG' },
];

interface BuildOpts {
  teams?: typeof mockTeams;
  linearEnabled?: boolean;
  selectedTeamId?: string | null;
  teamSummary?: string;
  isSavePending?: boolean;
  handleToggle?: (checked: boolean) => void;
  handleTeamChange?: (teamId: string) => void;
}

function buildProps(overrides: BuildOpts = {}) {
  const {
    teams = mockTeams,
    linearEnabled = false,
    selectedTeamId = null,
    teamSummary = 'Not configured',
    isSavePending = false,
    handleToggle = vi.fn(),
    handleTeamChange = vi.fn(),
  } = overrides;

  const t = ((key: string): string => {
    const messages: Record<string, string> = {
      enableToggle: 'Create Linear issue when task activates',
      teamLabel: 'Team',
      teamPlaceholder: 'Select a team',
    };
    return messages[key] ?? key;
  }) as never;

  const tI = ((key: string): string => {
    const messages: Record<string, string> = {
      notConfigured: 'Not configured',
    };
    return messages[key] ?? key;
  }) as never;

  return {
    taskTemplateId: 'tpl-1',
    teams,
    linearEnabled,
    selectedTeamId,
    handleToggle,
    handleTeamChange,
    saveMutation: { isPending: isSavePending } as never,
    teamSummary,
    t,
    tI,
  } as const;
}

describe('LinearTaskConfigView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the enable toggle and team label when connected', () => {
    render(<LinearTaskConfigView {...buildProps()} />);
    expect(
      screen.getByRole('switch', { name: 'Create Linear issue when task activates' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
  });

  it('toggle is disabled until a team is selected', () => {
    render(<LinearTaskConfigView {...buildProps({ selectedTeamId: null })} />);
    const sw = screen.getByRole('switch', { name: 'Create Linear issue when task activates' });
    expect(sw).toHaveAttribute('data-disabled', '');
  });

  it('toggle is enabled once a team is selected', () => {
    render(<LinearTaskConfigView {...buildProps({ selectedTeamId: 'team-1' })} />);
    const sw = screen.getByRole('switch', { name: 'Create Linear issue when task activates' });
    expect(sw).not.toHaveAttribute('data-disabled');
  });

  it('renders the team summary text', () => {
    render(<LinearTaskConfigView {...buildProps({ teamSummary: 'Engineering' })} />);
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('calls handleTeamChange when a different team is selected', async () => {
    const handleTeamChange = vi.fn();
    const { user } = setup(<LinearTaskConfigView {...buildProps({ handleTeamChange })} />);
    await user.selectOptions(screen.getByLabelText('select'), 'team-1');
    expect(handleTeamChange).toHaveBeenCalledWith('team-1');
  });
});
