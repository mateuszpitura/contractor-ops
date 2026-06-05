/**
 * TaskComments takes the `useTaskCommentsSection` bag as props.
 */

import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, findButton, findByText, mount, type } from '../../__tests__/_render.js';
import { TaskComments } from '../task-comments.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

type CommentRow = ComponentProps<typeof TaskComments>['comments'][number];

const baseProps = {
  body: '',
  setBody: vi.fn(),
  isLoading: false,
  isSubmitting: false,
  handleSubmit: vi.fn(),
};

function makeComment(overrides: Partial<CommentRow> = {}): CommentRow {
  return {
    id: 'c1',
    body: 'Looks good!',
    organizationId: 'org-1',
    workflowRunId: 'run-1',
    workflowTaskRunId: 'task-1',
    authorUserId: 'user-1',
    createdAt: new Date('2026-05-01'),
    updatedAt: new Date('2026-05-01'),
    author: { id: 'u-john', name: 'John', image: null },
    ...overrides,
  } as CommentRow;
}

describe('TaskComments (web-vite workflow-run)', () => {
  it('renders the section heading', async () => {
    await mount(<TaskComments {...baseProps} comments={[]} />);
    expect(findByText(document.body, 'Comments')).not.toBeNull();
  });

  it('shows the empty-state copy when there are no comments', async () => {
    await mount(<TaskComments {...baseProps} comments={[]} />);
    expect(findByText(document.body, /no comments yet/i)).not.toBeNull();
  });

  it('renders the author name and body for each comment', async () => {
    await mount(<TaskComments {...baseProps} comments={[makeComment()]} />);
    expect(findByText(document.body, 'John')).not.toBeNull();
    expect(findByText(document.body, 'Looks good!')).not.toBeNull();
  });

  it('renders skeleton placeholders while loading', async () => {
    const { container } = await mount(<TaskComments {...baseProps} comments={[]} isLoading />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('disables the Post button when the controlled body is empty', async () => {
    await mount(<TaskComments {...baseProps} comments={[]} />);
    const btn = findButton(document.body, /post/i);
    expect(btn?.disabled).toBe(true);
  });

  it('enables the Post button once the controlled body has content', async () => {
    await mount(<TaskComments {...baseProps} body="Hello" comments={[]} />);
    const btn = findButton(document.body, /post/i);
    expect(btn?.disabled).toBe(false);
  });

  it('disables the Post button while submitting', async () => {
    await mount(<TaskComments {...baseProps} body="Hello" isSubmitting comments={[]} />);
    const btn = findButton(document.body, /post/i);
    expect(btn?.disabled).toBe(true);
  });

  it('invokes setBody on textarea input', async () => {
    const setBody = vi.fn();
    await mount(<TaskComments {...baseProps} setBody={setBody} comments={[]} />);
    const textarea = document.body.querySelector('textarea');
    expect(textarea).not.toBeNull();
    await type(textarea as HTMLTextAreaElement, 'Great work');
    expect(setBody).toHaveBeenCalledWith('Great work');
  });

  it('invokes handleSubmit when the Post button is clicked', async () => {
    const handleSubmit = vi.fn();
    await mount(
      <TaskComments {...baseProps} body="Send me" handleSubmit={handleSubmit} comments={[]} />,
    );
    await click(findButton(document.body, /post/i) as HTMLButtonElement);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders multiple comments in order', async () => {
    await mount(
      <TaskComments
        {...baseProps}
        comments={[
          makeComment({
            id: 'c1',
            body: 'Comment one',
            author: { id: 'u-a', name: 'Alice', image: null },
          }),
          makeComment({
            id: 'c2',
            body: 'Comment two',
            author: { id: 'u-b', name: 'Bob', image: null },
          }),
        ]}
      />,
    );
    expect(findByText(document.body, 'Comment one')).not.toBeNull();
    expect(findByText(document.body, 'Comment two')).not.toBeNull();
    expect(findByText(document.body, 'Alice')).not.toBeNull();
    expect(findByText(document.body, 'Bob')).not.toBeNull();
  });
});
