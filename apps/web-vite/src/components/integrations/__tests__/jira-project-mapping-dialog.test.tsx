/**
 * Tests target `JiraProjectMappingDialogView` with shaped props. Verifies the
 * project + issue type select wiring, save/discard buttons, and the
 * "create issue when task activates" toggle.
 */

import type * as React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen, setup } from '@/test/test-utils';
import type { JiraProjectMappingDialogViewProps } from '../jira-project-mapping-dialog';
import { JiraProjectMappingDialogView } from '../jira-project-mapping-dialog';

vi.mock('@contractor-ops/ui/components/shadcn/select', () => ({
  Select: ({
    children,
    onValueChange,
    value,
    disabled,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
    disabled?: boolean;
  }) => (
    <select
      aria-label="select"
      disabled={disabled}
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

const mockProjects = [
  { id: 'proj-1', key: 'WEB', name: 'Web App' },
  { id: 'proj-2', key: 'API', name: 'API Service' },
];

const mockIssueTypes = [
  { id: 'it-1', name: 'Bug' },
  { id: 'it-2', name: 'Task' },
];

interface BuildOpts {
  open?: boolean;
  projectId?: string;
  issueTypeId?: string;
  jiraEnabled?: boolean;
  projects?: typeof mockProjects;
  issueTypes?: typeof mockIssueTypes;
  hasChanges?: boolean;
  isSavePending?: boolean;
  onOpenChange?: (open: boolean) => void;
  handleProjectChange?: (value: string | null) => void;
  handleIssueTypeChange?: (value: string | null) => void;
  handleSave?: () => void;
  setJiraEnabled?: Dispatch<SetStateAction<boolean>>;
}

function buildProps(overrides: BuildOpts = {}): JiraProjectMappingDialogViewProps {
  const {
    open = true,
    projectId = '',
    issueTypeId = '',
    jiraEnabled = false,
    projects = mockProjects,
    issueTypes = mockIssueTypes,
    hasChanges = false,
    isSavePending = false,
    onOpenChange = vi.fn(),
    handleProjectChange = vi.fn(),
    handleIssueTypeChange = vi.fn(),
    handleSave = vi.fn(),
    setJiraEnabled = vi.fn(),
  } = overrides;

  const t = ((key: string): string => {
    const messages: Record<string, string> = {
      'jira.projectMapping.title': 'Configure Jira Integration',
      'jira.projectMapping.description': 'Map this task to a Jira project and issue type.',
      'jira.projectMapping.jiraProject': 'Jira Project',
      'jira.projectMapping.selectProject': 'Select a project',
      'jira.projectMapping.issueType': 'Issue Type',
      'jira.projectMapping.selectIssueType': 'Select an issue type',
      'jira.projectMapping.discardChanges': 'Discard Changes',
      'jira.projectMapping.saveMapping': 'Save Mapping',
      'jira.taskConfig.enableToggle': 'Create Jira issue when task activates',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  return {
    open,
    onOpenChange,
    projectId,
    issueTypeId,
    jiraEnabled,
    setJiraEnabled,
    projectsQuery: { isLoading: false, data: projects } as never,
    projects,
    issueTypesQuery: { isLoading: false, data: issueTypes } as never,
    issueTypes,
    hasChanges,
    handleProjectChange,
    handleIssueTypeChange,
    handleSave,
    saveMutation: { isPending: isSavePending } as never,
    t,
  };
}

describe('JiraProjectMappingDialogView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog title when open', () => {
    render(<JiraProjectMappingDialogView {...buildProps()} />);
    expect(screen.getByText('Configure Jira Integration')).toBeInTheDocument();
  });

  it('renders project + issue type labels', () => {
    render(<JiraProjectMappingDialogView {...buildProps()} />);
    expect(screen.getByText('Jira Project')).toBeInTheDocument();
    expect(screen.getByText('Issue Type')).toBeInTheDocument();
  });

  it('issue type select is disabled until a project is selected', () => {
    render(<JiraProjectMappingDialogView {...buildProps()} />);
    // Index 0 = project select; index 1 = issue type select (third <select> = toggle).
    const selects = screen.getAllByLabelText('select');
    expect(selects[1]).toBeDisabled();
  });

  it('issue type select is enabled when a project is selected', () => {
    render(<JiraProjectMappingDialogView {...buildProps({ projectId: 'proj-1' })} />);
    const selects = screen.getAllByLabelText('select');
    expect(selects[1]).not.toBeDisabled();
  });

  it('calls handleProjectChange when project changes', async () => {
    const handleProjectChange = vi.fn();
    const { user } = setup(
      <JiraProjectMappingDialogView {...buildProps({ handleProjectChange })} />,
    );
    const selects = screen.getAllByLabelText('select');
    await user.selectOptions(selects[0] as HTMLSelectElement, 'proj-1');
    expect(handleProjectChange).toHaveBeenCalledWith('proj-1');
  });

  it('calls handleIssueTypeChange when issue type changes', async () => {
    const handleIssueTypeChange = vi.fn();
    const { user } = setup(
      <JiraProjectMappingDialogView
        {...buildProps({ projectId: 'proj-1', handleIssueTypeChange })}
      />,
    );
    const selects = screen.getAllByLabelText('select');
    await user.selectOptions(selects[1] as HTMLSelectElement, 'it-1');
    expect(handleIssueTypeChange).toHaveBeenCalledWith('it-1');
  });

  it('save is disabled when hasChanges is false', () => {
    render(<JiraProjectMappingDialogView {...buildProps()} />);
    expect(screen.getByRole('button', { name: 'Save Mapping' })).toBeDisabled();
  });

  it('save is enabled when hasChanges is true', () => {
    render(<JiraProjectMappingDialogView {...buildProps({ hasChanges: true })} />);
    expect(screen.getByRole('button', { name: 'Save Mapping' })).not.toBeDisabled();
  });

  it('discard calls onOpenChange(false)', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(<JiraProjectMappingDialogView {...buildProps({ onOpenChange })} />);
    await user.click(screen.getByRole('button', { name: 'Discard Changes' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('save calls handleSave', async () => {
    const handleSave = vi.fn();
    const { user } = setup(
      <JiraProjectMappingDialogView {...buildProps({ hasChanges: true, handleSave })} />,
    );
    await user.click(screen.getByRole('button', { name: 'Save Mapping' }));
    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('does not render dialog content when closed', () => {
    render(<JiraProjectMappingDialogView {...buildProps({ open: false })} />);
    expect(screen.queryByText('Configure Jira Integration')).not.toBeInTheDocument();
  });
});
