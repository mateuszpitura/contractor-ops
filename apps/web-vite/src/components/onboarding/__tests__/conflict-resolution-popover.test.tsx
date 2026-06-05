/**
 * ConflictResolutionPopover renders a Popover whose trigger is a Badge
 * showing the unresolved count. We assert on the visible trigger text.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConflictResolutionPopover } from '../conflict-resolution-popover.js';
import { findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const mockConflicts = [
  {
    field: 'name',
    values: [
      { source: 'JIRA', value: 'John Doe' },
      { source: 'SLACK', value: 'John D.' },
    ],
  },
];

describe('ConflictResolutionPopover (web-vite)', () => {
  it('renders the badge with the unresolved count "(1)" when nothing is resolved', async () => {
    await mount(
      <ConflictResolutionPopover
        conflicts={mockConflicts}
        resolvedConflicts={{}}
        onResolve={vi.fn()}
      />,
    );
    expect(findByText(document.body, /\(1\)/)).not.toBeNull();
  });

  it('renders "(0)" when all conflicts are resolved', async () => {
    await mount(
      <ConflictResolutionPopover
        conflicts={mockConflicts}
        resolvedConflicts={{ name: 'John Doe' }}
        onResolve={vi.fn()}
      />,
    );
    expect(findByText(document.body, /\(0\)/)).not.toBeNull();
  });

  it('renders "(2)" when two conflicts are unresolved', async () => {
    const conflicts = [
      ...mockConflicts,
      {
        field: 'email',
        values: [
          { source: 'JIRA', value: 'a@x.com' },
          { source: 'SLACK', value: 'b@x.com' },
        ],
      },
    ];
    await mount(
      <ConflictResolutionPopover
        conflicts={conflicts}
        resolvedConflicts={{}}
        onResolve={vi.fn()}
      />,
    );
    expect(findByText(document.body, /\(2\)/)).not.toBeNull();
  });
});
