import { describe, expect, it, vi } from 'vitest';

import { MarkDeliveredDialog } from '@/components/contractors/ir35-chain/mark-delivered-dialog';
import { render, screen, setup } from '@/test/test-utils';

describe('MarkDeliveredDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    mode: 'delivered' as const,
  };

  it('renders nothing when open is false', () => {
    const { container } = render(<MarkDeliveredDialog {...defaultProps} open={false} />);
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('renders a dialog when open is true', () => {
    render(<MarkDeliveredDialog {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the delivered mode title', () => {
    render(<MarkDeliveredDialog {...defaultProps} mode="delivered" />);
    expect(screen.getByText('Mark SDS delivered')).toBeInTheDocument();
  });

  it('shows the acknowledged mode title', () => {
    render(<MarkDeliveredDialog {...defaultProps} mode="acknowledged" />);
    expect(screen.getByText('Mark SDS acknowledged')).toBeInTheDocument();
  });

  it('renders the note textarea with label', () => {
    render(<MarkDeliveredDialog {...defaultProps} />);
    expect(screen.getByText('Note (optional)')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders Cancel and Confirm buttons', () => {
    render(<MarkDeliveredDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(<MarkDeliveredDialog {...defaultProps} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onConfirm with null when confirming with empty note', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const { user } = setup(
      <MarkDeliveredDialog {...defaultProps} onConfirm={onConfirm} onOpenChange={onOpenChange} />,
    );
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith(null);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onConfirm with the note text when a note is entered', async () => {
    const onConfirm = vi.fn();
    const { user } = setup(<MarkDeliveredDialog {...defaultProps} onConfirm={onConfirm} />);
    await user.type(screen.getByRole('textbox'), 'Delivered via email');
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith('Delivered via email');
  });
});
