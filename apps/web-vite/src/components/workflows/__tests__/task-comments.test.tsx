/**
 * Ported from apps/web/src/components/workflows/workflow-run/__tests__/task-comments.test.tsx.
 *
 * Web-vite TaskComments is fully presentational — the tRPC boundary lives
 * in `use-task-comments-section.ts`. The legacy test mocked
 * `@tanstack/react-query` + `@/trpc/init`; here we just feed the
 * presentational props the hook would have produced.
 */

import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TaskComments } from '../workflow-run/task-comments.js';
import { click, findButton, findByText, mount, type } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const baseProps = {
  body: '',
  setBody: vi.fn(),
  isLoading: false,
  isSubmitting: false,
  handleSubmit: vi.fn(),
};

type CommentRow = ComponentProps<typeof TaskComments>['comments'][number];

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
  };
}

const sampleComment = makeComment();

describe('TaskComments (web-vite)', () => {
  it('renders the section heading', async () => {
    await mount(<TaskComments {...baseProps} comments={[]} />);
    expect(findByText(document.body, 'Comments')).not.toBeNull();
  });

  it('shows the empty-state copy when there are no comments', async () => {
    await mount(<TaskComments {...baseProps} comments={[]} />);
    expect(findByText(document.body, 'No comments yet.')).not.toBeNull();
  });

  it('renders the author name and body for each comment', async () => {
    await mount(<TaskComments {...baseProps} comments={[sampleComment]} />);
    expect(findByText(document.body, 'John')).not.toBeNull();
    expect(findByText(document.body, 'Looks good!')).not.toBeNull();
  });

  it('falls back to "Unknown" when the author has no name', async () => {
    await mount(
      <TaskComments
        {...baseProps}
        comments={[
          makeComment({
            id: 'c2',
            body: 'Anonymous comment',
            author: { id: 'u-anon', name: null as unknown as string, image: null },
          }),
        ]}
      />,
    );
    expect(findByText(document.body, 'Unknown')).not.toBeNull();
  });

  it('renders skeleton placeholders while loading', async () => {
    const { container } = await mount(<TaskComments {...baseProps} comments={[]} isLoading />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('keeps the Post button disabled when the input is empty', async () => {
    await mount(<TaskComments {...baseProps} comments={[]} />);
    const button = findButton(document.body, 'Post');
    expect(button).not.toBeNull();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables the Post button once the controlled body has content', async () => {
    await mount(<TaskComments {...baseProps} comments={[]} body="Hello" />);
    const button = findButton(document.body, 'Post');
    expect(button).not.toBeNull();
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables the Post button while the mutation is pending', async () => {
    await mount(<TaskComments {...baseProps} comments={[]} body="Hello" isSubmitting />);
    expect((findButton(document.body, 'Post') as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls setBody on textarea input', async () => {
    const setBody = vi.fn();
    await mount(<TaskComments {...baseProps} setBody={setBody} comments={[]} />);
    const textarea = document.body.querySelector('textarea');
    expect(textarea).not.toBeNull();
    await type(textarea as HTMLTextAreaElement, 'Great work');
    expect(setBody).toHaveBeenCalled();
    expect(setBody).toHaveBeenCalledWith('Great work');
  });

  it('invokes handleSubmit when the Post button is clicked', async () => {
    const handleSubmit = vi.fn();
    await mount(
      <TaskComments {...baseProps} comments={[]} body="Send me" handleSubmit={handleSubmit} />,
    );
    await click(findButton(document.body, 'Post') as HTMLButtonElement);
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
            author: { id: 'u-alice', name: 'Alice', image: null },
          }),
          makeComment({
            id: 'c2',
            body: 'Comment two',
            author: { id: 'u-bob', name: 'Bob', image: null },
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
