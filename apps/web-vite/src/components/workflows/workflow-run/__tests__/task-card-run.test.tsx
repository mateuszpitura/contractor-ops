/**
 * TaskCardRun is presentational with helper props from `useTaskCardRun`. We
 * mock `useDateFormatter` (tRPC), the inline `DocLinksSection` container and
 * the `LinearTaskIssueChip` container.
 */

import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (typeof v === 'string' ? v : ''),
    formatTime: (v: unknown) => (typeof v === 'string' ? v : ''),
    formatDateTime: (v: unknown) => (typeof v === 'string' ? v : ''),
  }),
}));
vi.mock('../../../integrations/doc-links-section.js', () => ({
  DocLinksSection: () => null,
}));
vi.mock('../linear-task-issue-chip.js', () => ({
  LinearTaskIssueChip: () => null,
}));

import { findByText, mount } from '../../__tests__/_render.js';
import type { TaskCardRunTask } from '../task-card-run.js';
import { TaskCardRun } from '../task-card-run.js';

afterEach(() => {
  document.body.innerHTML = '';
});

type Props = ComponentProps<typeof TaskCardRun>;

function makeTask(overrides: Partial<TaskCardRunTask> = {}): TaskCardRunTask {
  return {
    id: 't1',
    title: 'Collect NDA',
    description: null,
    taskType: 'DOCUMENT_COLLECTION',
    status: 'TODO',
    required: false,
    assigneeUserId: null,
    assigneeRole: null,
    dueAt: null,
    completedAt: null,
    completedByUserId: null,
    startedAt: null,
    dependsOnTaskRunId: null,
    resultJson: null,
    isOverdue: false,
    createdAt: new Date('2026-04-15'),
    ...overrides,
  };
}

function makeSkip(): Props['skip'] {
  return {
    open: false,
    setOpen: vi.fn(),
    reason: '',
    setReason: vi.fn(),
    handleSkip: vi.fn(),
    skipMutation: { isPending: false },
  } as unknown as Props['skip'];
}

function makeReassign(): Props['reassign'] {
  return {
    open: false,
    setOpen: vi.fn(),
    selectedUserId: '',
    setSelectedUserId: vi.fn(),
    members: [],
    handleReassign: vi.fn(),
    reassignMutation: { isPending: false },
  } as unknown as Props['reassign'];
}

function makeCompleteMutation(): Props['completeMutation'] {
  return { mutate: vi.fn(), isPending: false } as unknown as Props['completeMutation'];
}

describe('TaskCardRun (web-vite)', () => {
  it('renders the task title', async () => {
    await mount(
      <TaskCardRun
        task={makeTask({ title: 'Sign NDA' })}
        runId="run-1"
        currentUserId="user-1"
        completeMutation={makeCompleteMutation()}
        skip={makeSkip()}
        reassign={makeReassign()}
      />,
    );
    expect(findByText(document.body, 'Sign NDA')).not.toBeNull();
  });

  it('renders the Complete CTA only when the task is assigned to me and actionable', async () => {
    await mount(
      <TaskCardRun
        task={makeTask({ status: 'TODO', assigneeUserId: 'user-1' })}
        runId="run-1"
        currentUserId="user-1"
        completeMutation={makeCompleteMutation()}
        skip={makeSkip()}
        reassign={makeReassign()}
      />,
    );
    const buttons = Array.from(document.body.querySelectorAll('button'));
    expect(buttons.some(b => /complete/i.test(b.textContent ?? ''))).toBe(true);
  });

  it('renders only the Reassign CTA when not assigned to me', async () => {
    await mount(
      <TaskCardRun
        task={makeTask({ status: 'TODO', assigneeUserId: 'someone-else' })}
        runId="run-1"
        currentUserId="user-1"
        completeMutation={makeCompleteMutation()}
        skip={makeSkip()}
        reassign={makeReassign()}
      />,
    );
    const buttons = Array.from(document.body.querySelectorAll('button'));
    expect(buttons.some(b => /complete/i.test(b.textContent ?? ''))).toBe(false);
    expect(buttons.some(b => /reassign/i.test(b.textContent ?? ''))).toBe(true);
  });

  it('renders the task type badge', async () => {
    await mount(
      <TaskCardRun
        task={makeTask({ taskType: 'APPROVAL' })}
        runId="run-1"
        currentUserId="user-1"
        completeMutation={makeCompleteMutation()}
        skip={makeSkip()}
        reassign={makeReassign()}
      />,
    );
    expect(findByText(document.body, /approval/i)).not.toBeNull();
  });

  it('renders the overdue label when isOverdue', async () => {
    await mount(
      <TaskCardRun
        task={makeTask({ isOverdue: true, dueAt: '2024-01-01' })}
        runId="run-1"
        currentUserId="user-1"
        completeMutation={makeCompleteMutation()}
        skip={makeSkip()}
        reassign={makeReassign()}
      />,
    );
    expect(findByText(document.body, /overdue/i)).not.toBeNull();
  });

  it('hides action buttons when the task is DONE', async () => {
    await mount(
      <TaskCardRun
        task={makeTask({ status: 'DONE', assigneeUserId: 'user-1' })}
        runId="run-1"
        currentUserId="user-1"
        completeMutation={makeCompleteMutation()}
        skip={makeSkip()}
        reassign={makeReassign()}
      />,
    );
    const buttons = Array.from(document.body.querySelectorAll('button'));
    expect(buttons.some(b => /complete/i.test(b.textContent ?? ''))).toBe(false);
  });
});
