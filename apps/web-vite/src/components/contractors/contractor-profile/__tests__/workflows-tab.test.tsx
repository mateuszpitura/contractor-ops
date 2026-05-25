/**
 * web-vite port of apps/web/.../workflows-tab.test.tsx.
 *
 * Container/component split — `WorkflowsTabView` takes the
 * `useContractorTabWorkflows` hook return as props. Tests mock the two
 * tRPC-bound child containers (jira summary + template picker) and inject
 * shaped props.
 */

import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../integrations/jira-activity-summary-container.js', () => ({
  JiraActivitySummary: () => <div data-testid="jira-summary" />,
}));

vi.mock('../../../workflows/template-picker-container.js', () => ({
  TemplatePickerContainer: () => null,
}));

import { render, screen } from '../../../../test/test-utils.js';
import type { ContractorTabWorkflowRunRow } from '../../hooks/use-contractor-tab-workflows.js';
import { WorkflowsTabEmpty, WorkflowsTabSkeleton, WorkflowsTabView } from '../workflows-tab.js';

type ViewProps = Parameters<typeof WorkflowsTabView>[0];

interface Overrides {
  items?: ContractorTabWorkflowRunRow[];
  isLoading?: boolean;
  page?: number;
  totalPages?: number;
  pickerOpen?: boolean;
  setPickerOpen?: ViewProps['setPickerOpen'];
  setPage?: ViewProps['setPage'];
}

function buildProps(override: Overrides = {}): ViewProps {
  return {
    contractorId: 'c1',
    pickerOpen: override.pickerOpen ?? false,
    setPickerOpen: override.setPickerOpen ?? vi.fn(),
    page: override.page ?? 1,
    setPage: override.setPage ?? vi.fn(),
    items: override.items ?? [],
    totalPages: override.totalPages ?? 1,
    isLoading: override.isLoading ?? false,
  };
}

function emptyProps(
  setPickerOpen?: Dispatch<SetStateAction<boolean>>,
): ComponentProps<typeof WorkflowsTabEmpty> {
  return {
    contractorId: 'c1',
    pickerOpen: false,
    setPickerOpen: setPickerOpen ?? (vi.fn() as unknown as Dispatch<SetStateAction<boolean>>),
  };
}

const sampleRun = (
  over: Partial<ContractorTabWorkflowRunRow> = {},
): ContractorTabWorkflowRunRow => ({
  id: 'run-1',
  status: 'IN_PROGRESS',
  startedAt: '2026-01-15',
  workflowTemplate: { name: 'Onboarding', type: 'ONBOARDING' },
  progress: { done: 2, total: 5, percent: 40 },
  ...over,
});

describe('WorkflowsTabView', () => {
  it('renders skeleton blocks while loading', () => {
    const { container } = render(<WorkflowsTabSkeleton />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it('renders the empty-state heading when there are no workflow runs', () => {
    render(<WorkflowsTabEmpty {...emptyProps()} />);
    expect(screen.getByText(/No workflows/i)).toBeInTheDocument();
  });

  it('renders the empty-state body copy', () => {
    render(<WorkflowsTabEmpty {...emptyProps()} />);
    expect(screen.getByText(/Start a workflow/i)).toBeInTheDocument();
  });

  it('renders the empty-state CTA button', () => {
    render(<WorkflowsTabEmpty {...emptyProps()} />);
    expect(screen.getByRole('button', { name: /Start workflow/i })).toBeInTheDocument();
  });

  it('renders a workflow run with template name + progress when data is present', () => {
    render(<WorkflowsTabView {...buildProps({ items: [sampleRun()] })} />);
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });

  it('renders the IN_PROGRESS status badge with localized label', () => {
    render(<WorkflowsTabView {...buildProps({ items: [sampleRun()] })} />);
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('renders the COMPLETED status badge with localized label', () => {
    render(
      <WorkflowsTabView
        {...buildProps({
          items: [
            sampleRun({
              status: 'COMPLETED',
              workflowTemplate: { name: 'Offboarding', type: 'OFFBOARDING' },
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders the "Start workflow" CTA in the populated state', () => {
    render(<WorkflowsTabView {...buildProps({ items: [sampleRun()] })} />);
    expect(screen.getByText('Start workflow')).toBeInTheDocument();
  });

  it('renders the section heading "Workflows" when items exist', () => {
    render(<WorkflowsTabView {...buildProps({ items: [sampleRun({ startedAt: null })] })} />);
    expect(screen.getByText('Workflows')).toBeInTheDocument();
  });

  it('renders the startedAt date in pl-PL format when present', () => {
    render(
      <WorkflowsTabView {...buildProps({ items: [sampleRun({ startedAt: '2026-03-15' })] })} />,
    );
    const expected = new Date('2026-03-15').toLocaleDateString('pl-PL');
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('falls back to "Workflow" when the template is null', () => {
    render(
      <WorkflowsTabView
        {...buildProps({ items: [sampleRun({ workflowTemplate: null, status: 'NOT_STARTED' })] })}
      />,
    );
    expect(screen.getByText('Workflow')).toBeInTheDocument();
  });

  it('does not render pagination when totalPages == 1', () => {
    render(<WorkflowsTabView {...buildProps({ items: [sampleRun()] })} />);
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
  });

  it('renders pagination when totalPages > 1', () => {
    render(<WorkflowsTabView {...buildProps({ items: [sampleRun()], totalPages: 4 })} />);
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
  });

  it('invokes setPickerOpen(true) when the empty-state CTA is clicked', () => {
    const setPickerOpen = vi.fn();
    render(<WorkflowsTabEmpty {...emptyProps(setPickerOpen)} />);
    screen.getByRole('button', { name: /Start workflow/i }).click();
    expect(setPickerOpen).toHaveBeenCalledWith(true);
  });

  it('always renders the JiraActivitySummary block', () => {
    render(<WorkflowsTabView {...buildProps({ items: [sampleRun()] })} />);
    expect(screen.getByTestId('jira-summary')).toBeInTheDocument();
  });
});
