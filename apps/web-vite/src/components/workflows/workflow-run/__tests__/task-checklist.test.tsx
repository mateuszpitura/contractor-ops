/**
 * Ported from apps/web/src/components/workflows/workflow-run/__tests__/task-checklist.test.tsx.
 *
 * Web-vite TaskChecklist still composes TaskCardRunContainer (which fetches
 * tRPC). We mock the row container so the test only verifies the list
 * scaffolding (heading + one row per task).
 */

import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../task-card-run-container.js', () => {
  const React = require('react');
  return {
    TaskCardRunContainer: ({ task }: { task: { id: string; title: string } }) =>
      React.createElement('div', { 'data-testid': `task-row-${task.id}` }, task.title),
  };
});
vi.mock('../../../contracts/contract-detail/linear-linked-issues-panel-container.js', () => ({
  LinearLinkedIssuesPanelContainer: () => null,
}));

import { findByText, mount } from '../../__tests__/_render.js';
import { TaskChecklist } from '../task-checklist.js';

afterEach(() => {
  document.body.innerHTML = '';
});

type Props = ComponentProps<typeof TaskChecklist>;
type Task = Props['tasks'][number];

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task 1',
    description: null,
    taskType: 'MANUAL',
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

describe('TaskChecklist (web-vite)', () => {
  it('renders the tasks heading', async () => {
    await mount(<TaskChecklist tasks={[]} runId="run-1" currentUserId={null} />);
    expect(findByText(document.body, /tasks/i)).not.toBeNull();
  });

  it('renders skeleton placeholders when isLoading', async () => {
    await mount(<TaskChecklist tasks={[]} runId="run-1" currentUserId={null} isLoading={true} />);
    expect(document.body.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('renders one TaskCardRunContainer per task', async () => {
    await mount(
      <TaskChecklist
        tasks={[
          makeTask({ id: 't1', title: 'Task one' }),
          makeTask({ id: 't2', title: 'Task two' }),
        ]}
        runId="run-1"
        currentUserId={null}
      />,
    );
    expect(document.body.querySelector("[data-testid='task-row-t1']")).not.toBeNull();
    expect(document.body.querySelector("[data-testid='task-row-t2']")).not.toBeNull();
  });

  it('dims the row when a task was condition-skipped', async () => {
    await mount(
      <TaskChecklist
        tasks={[
          makeTask({
            id: 'skipped',
            status: 'SKIPPED',
            resultJson: { skipReason: 'conditionNotMet' },
          }),
        ]}
        runId="run-1"
        currentUserId={null}
      />,
    );
    const wrappers = Array.from(document.body.querySelectorAll('div')).filter(d =>
      d.className.includes('opacity-50'),
    );
    expect(wrappers.length).toBeGreaterThan(0);
  });
});
