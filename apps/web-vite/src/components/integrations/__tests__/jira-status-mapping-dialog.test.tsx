/**
 * Tests target the view component (`JiraStatusMappingDialogView`) directly
 * with shaped props matching the hook return type. Avoids tRPC mocking and
 * mirrors the apps/web-vite container → view split convention.
 */

import type * as React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/i18n/useTranslations';
import { render, screen, setup } from '@/test/test-utils';
import type { JiraStatusMappingDialogViewProps } from '../jira-status-mapping-dialog';
import { JiraStatusMappingDialogView } from '../jira-status-mapping-dialog';

// Replace the Base UI select (portal + inert dialog parent → flaky under jsdom)
// with a native <select>. Tests still drive the same onValueChange contract.
vi.mock('@contractor-ops/ui/components/shadcn/select', () => {
  return {
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
        aria-expanded={false}
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
  };
});

const mockProjects = [
  { id: 'proj-1', key: 'WEB', name: 'Web App' },
  { id: 'proj-2', key: 'API', name: 'API Service' },
];

const mockStatuses = [
  { id: 'js-1', name: 'Open', statusCategory: { key: 'new', name: 'New' } },
  { id: 'js-2', name: 'Done', statusCategory: { key: 'done', name: 'Done' } },
];

interface BuildProps {
  open?: boolean;
  selectedProjectId?: string | null;
  projects?: typeof mockProjects;
  jiraStatuses?: typeof mockStatuses;
  hasChanges?: boolean;
  isSavePending?: boolean;
  projectsLoading?: boolean;
  statusesLoading?: boolean;
  mappedIds?: Record<string, string>;
  onOpenChange?: (open: boolean) => void;
  handleSave?: () => void;
  handleStatusSelect?: (workflowStatus: string, jiraStatusId: string) => void;
  setSelectedProjectId?: Dispatch<SetStateAction<string | null>>;
}

function buildProps(overrides: BuildProps = {}): JiraStatusMappingDialogViewProps {
  const {
    open = true,
    selectedProjectId = null,
    projects = mockProjects,
    jiraStatuses = mockStatuses,
    hasChanges = false,
    isSavePending = false,
    projectsLoading = false,
    statusesLoading = false,
    mappedIds = {},
    onOpenChange = vi.fn(),
    handleSave = vi.fn(),
    handleStatusSelect = vi.fn(),
    setSelectedProjectId = vi.fn(),
  } = overrides;

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // `t` returns the EN message (or interpolated message) — production-equivalent
  // resolution would route through useTranslations, but the view is generic
  // over the `t` shape, so a stub keeps tests isolated from i18n bundle drift.
  const t = ((key: string, values?: Record<string, string>): string => {
    const messages: Record<string, string> = {
      title: 'Status Mapping',
      description: `Map workflow task statuses to Jira transitions for ${values?.projectName ?? ''}.`,
      descriptionDefault: 'Map workflow task statuses to Jira transitions.',
      jiraProject: 'Jira Project',
      selectProject: 'Select a project',
      workflowStatus: 'Workflow Status',
      jiraTransition: 'Jira Transition',
      notMapped: 'Not mapped',
      unmappedTooltip: 'Not mapped — status changes for this state will be ignored',
      discardChanges: 'Discard Changes',
      saveMapping: 'Save Mapping',
    };
    return messages[key] ?? key;
  }) as TranslateFn;

  return {
    open,
    onOpenChange,
    selectedProjectId,
    setSelectedProjectId,
    projectsQuery: { isLoading: projectsLoading, data: projects } as never,
    projects,
    statusesQuery: { isLoading: statusesLoading, data: jiraStatuses } as never,
    jiraStatuses,
    selectedProject,
    hasChanges,
    handleStatusSelect,
    handleSave,
    getMappedJiraStatusId: (ws: string) => mappedIds[ws],
    saveMutation: { isPending: isSavePending } as never,
    t,
  };
}

describe('JiraStatusMappingDialogView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog title when open', () => {
    render(<JiraStatusMappingDialogView {...buildProps()} />);
    expect(screen.getByText('Status Mapping')).toBeInTheDocument();
  });

  it('renders default description before a project is selected', () => {
    render(<JiraStatusMappingDialogView {...buildProps()} />);
    expect(screen.getByText('Map workflow task statuses to Jira transitions.')).toBeInTheDocument();
  });

  it('renders save and discard buttons', () => {
    render(<JiraStatusMappingDialogView {...buildProps()} />);
    expect(screen.getByRole('button', { name: 'Save Mapping' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard Changes' })).toBeInTheDocument();
  });

  it('save button is disabled without project selection', () => {
    render(<JiraStatusMappingDialogView {...buildProps()} />);
    expect(screen.getByRole('button', { name: 'Save Mapping' })).toBeDisabled();
  });

  it('save button is disabled when hasChanges is false even with a selected project', () => {
    render(
      <JiraStatusMappingDialogView
        {...buildProps({ selectedProjectId: 'proj-1', hasChanges: false })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save Mapping' })).toBeDisabled();
  });

  it('save button is enabled when project selected and hasChanges is true', () => {
    render(
      <JiraStatusMappingDialogView
        {...buildProps({ selectedProjectId: 'proj-1', hasChanges: true })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save Mapping' })).not.toBeDisabled();
  });

  it('calls onOpenChange(false) when discard clicked', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(<JiraStatusMappingDialogView {...buildProps({ onOpenChange })} />);
    await user.click(screen.getByRole('button', { name: 'Discard Changes' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls handleSave when save clicked with changes', async () => {
    const handleSave = vi.fn();
    const { user } = setup(
      <JiraStatusMappingDialogView
        {...buildProps({ selectedProjectId: 'proj-1', hasChanges: true, handleSave })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save Mapping' }));
    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('does not render the mapping table without a project selection', () => {
    render(<JiraStatusMappingDialogView {...buildProps()} />);
    expect(screen.queryByText('Workflow Status')).not.toBeInTheDocument();
  });

  it('renders the mapping table once a project is selected', () => {
    render(<JiraStatusMappingDialogView {...buildProps({ selectedProjectId: 'proj-1' })} />);
    expect(screen.getByText('Workflow Status')).toBeInTheDocument();
    expect(screen.getByText('Jira Transition')).toBeInTheDocument();
  });

  it('renders all six workflow status rows after project selection', () => {
    render(<JiraStatusMappingDialogView {...buildProps({ selectedProjectId: 'proj-1' })} />);
    // "Done" appears both as workflow row label and as a Jira transition option,
    // so we just assert each label appears at least once.
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Done').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Skipped')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('renders interpolated description with project name after selection', () => {
    render(<JiraStatusMappingDialogView {...buildProps({ selectedProjectId: 'proj-1' })} />);
    expect(screen.getByText(/for Web App/)).toBeInTheDocument();
  });

  it('calls handleStatusSelect when changing a per-status select', async () => {
    const handleStatusSelect = vi.fn();
    const { user } = setup(
      <JiraStatusMappingDialogView
        {...buildProps({ selectedProjectId: 'proj-1', handleStatusSelect })}
      />,
    );
    // Project select is index 0; per-row status selects start at 1.
    const selects = screen.getAllByLabelText('select');
    expect(selects.length).toBeGreaterThan(1);
    await user.selectOptions(selects[1] as HTMLSelectElement, 'js-1');
    expect(handleStatusSelect).toHaveBeenCalledWith('TODO', 'js-1');
  });

  it('does not render dialog content when closed', () => {
    render(<JiraStatusMappingDialogView {...buildProps({ open: false })} />);
    expect(screen.queryByText('Status Mapping')).not.toBeInTheDocument();
  });
});
