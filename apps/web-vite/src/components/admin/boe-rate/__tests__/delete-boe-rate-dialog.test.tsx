/**
 * Confirm-gate coverage for the delete-BoE-rate destructive dialog.
 *
 * DeleteBoeRateDialog receives the delete mutation as a prop and only calls
 * `mutate({ id })` from its confirm handler, so the test passes a spy mutation
 * object and asserts the delete fires only after the explicit destructive
 * action — never on render. Real `useTranslations` runs against the English
 * bundle, so CTAs are matched via the destructive button role.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { BoeRateEntry, useBoeRateDelete } from '../../hooks/use-admin-boe-rate';
import { DeleteBoeRateDialog } from '../delete-boe-rate-dialog';

type DeleteMutation = ReturnType<typeof useBoeRateDelete>;

const entry: BoeRateEntry = {
  id: 'rate-1',
  effectiveFrom: '2026-04-01T00:00:00Z',
  ratePercent: 5.25,
  source: 'MANUAL',
  notes: null,
  recordedByUserId: null,
  recordedAt: '2026-04-01T00:00:00Z',
  createdAt: '2026-04-01T00:00:00Z',
};

function buildMutation(overrides: Partial<DeleteMutation> = {}): DeleteMutation {
  return {
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as DeleteMutation;
}

function findConfirmButton(): HTMLElement {
  const buttons = screen.getAllByRole('button');
  const confirm = buttons.find(b => b.className.includes('bg-destructive'));
  if (!confirm) throw new Error('destructive confirm button not found');
  return confirm;
}

describe('DeleteBoeRateDialog', () => {
  it('renders the destructive confirm and cancel actions when open', () => {
    render(
      <DeleteBoeRateDialog
        entry={entry}
        open
        onOpenChange={vi.fn()}
        deleteMutation={buildMutation()}
      />,
    );

    expect(findConfirmButton()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('does not render destructive content when closed', () => {
    render(
      <DeleteBoeRateDialog
        entry={entry}
        open={false}
        onOpenChange={vi.fn()}
        deleteMutation={buildMutation()}
      />,
    );

    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });

  it('does NOT call mutate on render — only on explicit confirm, with the row id', async () => {
    const mutate = vi.fn();
    const { user } = setup(
      <DeleteBoeRateDialog
        entry={entry}
        open
        onOpenChange={vi.fn()}
        deleteMutation={buildMutation({ mutate })}
      />,
    );

    expect(mutate).not.toHaveBeenCalled();

    await user.click(findConfirmButton());
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({ id: 'rate-1' });
  });

  it('does not call mutate when only cancel is clicked', async () => {
    const mutate = vi.fn();
    const { user } = setup(
      <DeleteBoeRateDialog
        entry={entry}
        open
        onOpenChange={vi.fn()}
        deleteMutation={buildMutation({ mutate })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mutate).not.toHaveBeenCalled();
  });

  it('disables the destructive action while the delete is pending', () => {
    render(
      <DeleteBoeRateDialog
        entry={entry}
        open
        onOpenChange={vi.fn()}
        deleteMutation={buildMutation({ isPending: true })}
      />,
    );

    expect(findConfirmButton()).toBeDisabled();
  });
});
