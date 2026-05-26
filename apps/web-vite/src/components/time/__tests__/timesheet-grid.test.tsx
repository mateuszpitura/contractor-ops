/**
 * Step-10 port. TimesheetGrid is the inline-edit weekly grid for
 * contractors; we exercise empty-state, project header rendering, and
 * the rejection banner branch.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '../../../test/test-utils.js';
import { TimesheetGrid } from '../timesheet-grid.js';

const weekStart = new Date('2026-04-13T00:00:00Z');

function baseProps() {
  return {
    weekStartDate: weekStart,
    entries: [],
    contracts: [
      { id: 'ct-1', title: 'Acme Web Dev' },
      { id: 'ct-2', title: 'Beta Mobile' },
    ],
    timesheetId: 't-1',
    disabled: false,
    rejectionReason: null,
    onSave: vi.fn(),
  };
}

describe('TimesheetGrid (web-vite)', () => {
  it('renders the empty card when no contracts are provided', () => {
    render(<TimesheetGrid {...baseProps()} contracts={[]} />);
    expect(screen.getByText(/No active contracts/i)).toBeInTheDocument();
  });

  it('renders one row per contract with the title in the leading cell', () => {
    render(<TimesheetGrid {...baseProps()} />);
    expect(screen.getByText('Acme Web Dev')).toBeInTheDocument();
    expect(screen.getByText('Beta Mobile')).toBeInTheDocument();
  });

  it('renders the rejection banner when rejectionReason is provided', () => {
    render(<TimesheetGrid {...baseProps()} rejectionReason="Missing approvals" />);
    expect(screen.getByText(/Missing approvals/)).toBeInTheDocument();
  });

  it('renders Mon..Sun day headers and a Project header', () => {
    render(<TimesheetGrid {...baseProps()} />);
    for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(screen.getByText(d)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Project').length).toBeGreaterThan(0);
  });

  it('disables every cell input when disabled is true', () => {
    render(<TimesheetGrid {...baseProps()} disabled />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) expect(input).toBeDisabled();
  });

  it('calls onSave with the edited cell on blur', async () => {
    const onSave = vi.fn();
    const { user } = setup(<TimesheetGrid {...baseProps()} onSave={onSave} />);
    const cells = screen.getAllByRole('spinbutton');
    await user.click(cells[0]);
    await user.keyboard('4');
    await user.tab();
    expect(onSave).toHaveBeenCalled();
    const last = onSave.mock.calls.at(-1)?.[0];
    expect(last[0].minutes).toBe(60 * 4);
    expect(last[0].contractId).toBe('ct-1');
  });
});
