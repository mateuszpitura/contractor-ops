/**
 * TaskCard takes `users`/`usersQuery` directly (no longer
 * fetches them) plus integration containers are mocked here because they
 * depend on tRPC.
 */

import type { ComponentProps, ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../integrations/jira-task-config-container.js', () => ({
  JiraTaskConfig: () => null,
}));
vi.mock('../../../integrations/linear-task-config-container.js', () => ({
  LinearTaskConfig: () => null,
}));
vi.mock('../../calendar-task-config-container.js', () => ({
  CalendarTaskConfig: () => null,
}));
vi.mock('../condition-builder.js', () => {
  const React = require('react');
  return {
    ConditionBuilder: () => React.createElement('div', null, 'ConditionBuilder'),
    getConditionSummary: () => null,
  };
});

import { findByText, mount } from '../../__tests__/_render.js';
import { TaskCard } from '../task-card.js';

afterEach(() => {
  document.body.innerHTML = '';
});

type Props = ComponentProps<typeof TaskCard>;

function createMockForm(taskData: Record<string, unknown> = {}): Props['form'] {
  const defaultTask = {
    title: 'Test Task',
    taskType: 'MANUAL',
    assigneeMode: 'ROLE_BASED',
    required: false,
    conditions: null,
    dueOffsetDays: null,
    ...taskData,
  };
  return {
    watch: vi.fn((path: string) => {
      if (typeof path === 'string' && path.startsWith('tasks.')) return defaultTask;
      return;
    }),
    register: vi.fn(() => ({ name: 'test', onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() })),
    setValue: vi.fn(),
  } as unknown as Props['form'];
}

function makeProps(task: Record<string, unknown>, overrides: Partial<Props> = {}): ReactElement {
  return (
    <TaskCard
      index={0}
      allTasks={[]}
      form={createMockForm(task)}
      onRemove={vi.fn()}
      users={[]}
      usersQuery={{ isLoading: false }}
      isFixedUserLoading={false}
      {...overrides}
    />
  );
}

describe('TaskCard (web-vite)', () => {
  it('renders collapsed header with task title', async () => {
    await mount(makeProps({ title: 'Collect NDA' }));
    expect(findByText(document.body, 'Collect NDA')).not.toBeNull();
  });

  it('shows untitled task copy when title is empty', async () => {
    await mount(makeProps({ title: '' }));
    expect(findByText(document.body, /untitled task/i)).not.toBeNull();
  });

  it('renders the task type badge label', async () => {
    await mount(makeProps({ taskType: 'APPROVAL' }));
    expect(findByText(document.body, /approval/i)).not.toBeNull();
  });

  it('renders the required badge when required is true', async () => {
    await mount(makeProps({ required: true }));
    expect(findByText(document.body, /required task/i)).not.toBeNull();
  });

  it('renders at least one button (drag handle)', async () => {
    const { container } = await mount(makeProps({}));
    expect(container.querySelectorAll('button').length).toBeGreaterThanOrEqual(1);
  });

  it('does not render ConditionBuilder when collapsed (no summary returned)', async () => {
    await mount(makeProps({}));
    expect(findByText(document.body, 'ConditionBuilder')).toBeNull();
  });
});
