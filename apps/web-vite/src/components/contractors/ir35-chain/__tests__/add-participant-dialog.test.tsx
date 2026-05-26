/**
 * web-vite port. View takes addParticipant + isPending + mutation as props.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import { AddParticipantDialogView } from '../add-participant-dialog.js';

function makeMutation(overrides: Partial<{ isError: boolean; error: Error }> = {}) {
  return {
    isError: false,
    error: undefined as Error | undefined,
    ...overrides,
  } as unknown as Parameters<typeof AddParticipantDialogView>[0]['mutation'];
}

const baseProps = {
  engagementId: 'cass_1',
  nextOrderIndex: 2,
  open: true,
  onOpenChange: vi.fn(),
  addParticipant: vi.fn(),
  isPending: false,
  mutation: makeMutation(),
};

describe('AddParticipantDialogView', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(<AddParticipantDialogView {...baseProps} open={false} />);
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('renders a dialog when open is true', () => {
    render(<AddParticipantDialogView {...baseProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the dialog title', () => {
    render(<AddParticipantDialogView {...baseProps} />);
    expect(screen.getByText('Add chain participant')).toBeInTheDocument();
  });

  it('renders the hint description', () => {
    render(<AddParticipantDialogView {...baseProps} />);
    expect(screen.getByText(/Add an agency or personal service company/)).toBeInTheDocument();
  });

  it('renders the display name field', () => {
    render(<AddParticipantDialogView {...baseProps} />);
    expect(screen.getByText('Display name')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /display name/i })).toBeInTheDocument();
  });

  it('renders the role select with Agency and PSC options', () => {
    render(<AddParticipantDialogView {...baseProps} />);
    expect(screen.getByText('Role')).toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: /role/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByText('Agency')).toBeInTheDocument();
    expect(screen.getByText('PSC')).toBeInTheDocument();
  });

  it('renders the contact email field', () => {
    render(<AddParticipantDialogView {...baseProps} />);
    expect(screen.getByText('Contact email')).toBeInTheDocument();
  });

  it('renders Cancel and Save buttons', () => {
    render(<AddParticipantDialogView {...baseProps} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(<AddParticipantDialogView {...baseProps} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
