/**
 * web-vite port. View takes notes hook output as props.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import type { RightRailContractor } from '../right-rail.js';
import { RightRailView } from '../right-rail.js';

function makeNoteMutation(overrides: Partial<{ isPending: boolean }> = {}) {
  return {
    isPending: false,
    ...overrides,
  } as unknown as Parameters<typeof RightRailView>[0]['noteSaveMutation'];
}

const contractor: RightRailContractor = {
  id: 'c1',
  notes: null,
  createdAt: new Date('2024-06-01T00:00:00Z'),
  updatedAt: new Date('2024-06-01T00:00:00Z'),
  lifecycleStage: 'ACTIVE',
};

describe('RightRailView', () => {
  it('renders activity, notes, and reminders headings', () => {
    render(
      <RightRailView
        contractor={contractor}
        notes=""
        isDirty={false}
        updateNotes={vi.fn()}
        saveNotes={vi.fn()}
        noteSaveMutation={makeNoteMutation()}
      />,
    );
    expect(screen.getAllByRole('heading').length).toBeGreaterThanOrEqual(3);
  });

  it('renders the notes textarea with the supplied value', () => {
    render(
      <RightRailView
        contractor={contractor}
        notes="Hello"
        isDirty={false}
        updateNotes={vi.fn()}
        saveNotes={vi.fn()}
        noteSaveMutation={makeNoteMutation()}
      />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('Hello');
  });

  it('calls updateNotes when the user types', async () => {
    const updateNotes = vi.fn();
    const { user } = setup(
      <RightRailView
        contractor={contractor}
        notes=""
        isDirty={false}
        updateNotes={updateNotes}
        saveNotes={vi.fn()}
        noteSaveMutation={makeNoteMutation()}
      />,
    );
    await user.type(screen.getByRole('textbox'), 'a');
    expect(updateNotes).toHaveBeenCalledWith('a');
  });

  it('shows the Save button only when notes are dirty', () => {
    const { rerender } = render(
      <RightRailView
        contractor={contractor}
        notes=""
        isDirty={false}
        updateNotes={vi.fn()}
        saveNotes={vi.fn()}
        noteSaveMutation={makeNoteMutation()}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();

    rerender(
      <RightRailView
        contractor={contractor}
        notes="changed"
        isDirty={true}
        updateNotes={vi.fn()}
        saveNotes={vi.fn()}
        noteSaveMutation={makeNoteMutation()}
      />,
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('invokes saveNotes when Save is clicked', async () => {
    const saveNotes = vi.fn();
    const { user } = setup(
      <RightRailView
        contractor={contractor}
        notes="changed"
        isDirty={true}
        updateNotes={vi.fn()}
        saveNotes={saveNotes}
        noteSaveMutation={makeNoteMutation()}
      />,
    );
    await user.click(screen.getByRole('button'));
    expect(saveNotes).toHaveBeenCalled();
  });
});
