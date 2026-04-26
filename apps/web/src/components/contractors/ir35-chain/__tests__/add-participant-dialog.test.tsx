import { describe, expect, it, vi } from 'vitest';

vi.mock('@/trpc/init', () => ({
  trpc: {
    ir35Chain: {
      upsertParticipant: {
        mutationOptions: (opts?: Record<string, unknown>) => ({
          mutationFn: async () => ({}),
          ...opts,
        }),
      },
    },
  },
}));

import { AddParticipantDialog } from '@/components/contractors/ir35-chain/add-participant-dialog';
import { render, screen, setup } from '@/test/test-utils';

describe('AddParticipantDialog', () => {
  const defaultProps = {
    engagementId: 'cass_1',
    nextOrderIndex: 2,
    open: true,
    onOpenChange: vi.fn(),
  };

  it('renders nothing when open is false', () => {
    const { container } = render(<AddParticipantDialog {...defaultProps} open={false} />);
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('renders a dialog when open is true', () => {
    render(<AddParticipantDialog {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the dialog title', () => {
    render(<AddParticipantDialog {...defaultProps} />);
    expect(screen.getByText('Add chain participant')).toBeInTheDocument();
  });

  it('renders the hint description', () => {
    render(<AddParticipantDialog {...defaultProps} />);
    expect(screen.getByText(/Add an agency or personal service company/)).toBeInTheDocument();
  });

  it('renders the display name field', () => {
    render(<AddParticipantDialog {...defaultProps} />);
    expect(screen.getByText('Display name')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /display name/i })).toBeInTheDocument();
  });

  it('renders the role select with Agency and PSC options', () => {
    render(<AddParticipantDialog {...defaultProps} />);
    expect(screen.getByText('Role')).toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: /role/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByText('Agency')).toBeInTheDocument();
    expect(screen.getByText('PSC')).toBeInTheDocument();
  });

  it('renders the contact email field', () => {
    render(<AddParticipantDialog {...defaultProps} />);
    expect(screen.getByText('Contact email')).toBeInTheDocument();
  });

  it('renders Cancel and Save buttons', () => {
    render(<AddParticipantDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(<AddParticipantDialog {...defaultProps} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
