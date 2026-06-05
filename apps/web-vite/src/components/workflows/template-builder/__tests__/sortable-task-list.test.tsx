/**
 * We mock dnd-kit
 * + TaskCardContainer so the test focuses on empty / populated rendering
 * and the onAdd CTA.
 */

import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@dnd-kit/core', () => {
  const React = require('react');
  return {
    DndContext: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    closestCenter: vi.fn(),
    PointerSensor: vi.fn(),
    KeyboardSensor: vi.fn(),
    useSensor: vi.fn(),
    useSensors: vi.fn(() => []),
  };
});

vi.mock('@dnd-kit/sortable', () => {
  const React = require('react');
  return {
    SortableContext: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    verticalListSortingStrategy: {},
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
      isDragging: false,
    }),
    sortableKeyboardCoordinates: vi.fn(),
  };
});

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

vi.mock('../task-card-container.js', () => {
  const React = require('react');
  return {
    TaskCardContainer: ({ index }: { index: number }) =>
      React.createElement('div', { 'data-testid': `task-card-${index}` }, `Task ${index}`),
  };
});

import { click, findButton, findByText, mount } from '../../__tests__/_render.js';
import { SortableTaskList } from '../sortable-task-list.js';

afterEach(() => {
  document.body.innerHTML = '';
});

type Props = ComponentProps<typeof SortableTaskList>;

const mockForm = {
  watch: vi.fn(),
  register: vi.fn(),
  setValue: vi.fn(),
} as unknown as Props['form'];

describe('SortableTaskList (web-vite)', () => {
  it('renders empty state with add CTA when no fields', async () => {
    await mount(
      <SortableTaskList
        fields={[]}
        tasks={[]}
        form={mockForm}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(findByText(document.body, /add your first task/i)).not.toBeNull();
    expect(findByText(document.body, /add task/i)).not.toBeNull();
  });

  it('renders one TaskCardContainer per field', async () => {
    await mount(
      <SortableTaskList
        fields={[{ id: 'f1' }, { id: 'f2' }]}
        tasks={[{ title: 'Task 1' } as never, { title: 'Task 2' } as never]}
        form={mockForm}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(document.body.querySelector("[data-testid='task-card-0']")).not.toBeNull();
    expect(document.body.querySelector("[data-testid='task-card-1']")).not.toBeNull();
  });

  it('renders the add task button below the populated list', async () => {
    await mount(
      <SortableTaskList
        fields={[{ id: 'f1' }]}
        tasks={[{ title: 'Task 1' } as never]}
        form={mockForm}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(findByText(document.body, /add task/i)).not.toBeNull();
  });

  it('invokes onAdd when the add task button is clicked', async () => {
    const onAdd = vi.fn();
    await mount(
      <SortableTaskList
        fields={[]}
        tasks={[]}
        form={mockForm}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
        onAdd={onAdd}
      />,
    );
    const btn = findButton(document.body, /add task/i);
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onAdd).toHaveBeenCalled();
  });
});
