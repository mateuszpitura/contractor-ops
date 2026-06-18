/**
 * Confirm-gate coverage for the delete-Leitweg-ID destructive dialog.
 *
 * LeitwegIdDeleteDialogView receives `handleConfirm` (the mutation trigger)
 * from its hook as a prop, so the test passes a spy and asserts the delete
 * fires only after the explicit destructive action — never on render. The
 * confirm action carries a stable `leitweg-delete-confirm` testid; a stubbed
 * `tCommon` echoes the cancel key.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { useLeitwegIdDeleteDialog } from '../hooks/use-leitweg-id-delete-dialog';
import {
  LEITWEG_DELETE_BUTTON,
  LEITWEG_DELETE_HEADING,
} from '../hooks/use-leitweg-id-delete-dialog';
import { LeitwegIdDeleteDialogView } from '../leitweg-id-delete-dialog';

type HookReturn = ReturnType<typeof useLeitwegIdDeleteDialog>;

const tCommonStub = (key: string) => key;

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    deleteMutation: {} as HookReturn['deleteMutation'],
    isPending: false,
    handleConfirm: vi.fn(),
    ...overrides,
  } as HookReturn;
}

describe('LeitwegIdDeleteDialogView', () => {
  it('renders the heading, destructive confirm and cancel actions when open', () => {
    render(
      <LeitwegIdDeleteDialogView
        open
        onOpenChange={vi.fn()}
        tCommon={tCommonStub}
        {...buildHook()}
      />,
    );

    expect(screen.getByText(LEITWEG_DELETE_HEADING)).toBeInTheDocument();
    expect(screen.getByTestId('leitweg-delete-confirm')).toHaveTextContent(LEITWEG_DELETE_BUTTON);
    expect(screen.getByText('cancel')).toBeInTheDocument();
  });

  it('does not render destructive content when closed', () => {
    render(
      <LeitwegIdDeleteDialogView
        open={false}
        onOpenChange={vi.fn()}
        tCommon={tCommonStub}
        {...buildHook()}
      />,
    );

    expect(screen.queryByTestId('leitweg-delete-confirm')).not.toBeInTheDocument();
  });

  it('does NOT fire the delete mutation on render — only on explicit confirm', async () => {
    const handleConfirm = vi.fn();
    const { user } = setup(
      <LeitwegIdDeleteDialogView
        open
        onOpenChange={vi.fn()}
        tCommon={tCommonStub}
        {...buildHook({ handleConfirm })}
      />,
    );

    expect(handleConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('leitweg-delete-confirm'));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not fire the delete mutation when only cancel is clicked', async () => {
    const handleConfirm = vi.fn();
    const { user } = setup(
      <LeitwegIdDeleteDialogView
        open
        onOpenChange={vi.fn()}
        tCommon={tCommonStub}
        {...buildHook({ handleConfirm })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(handleConfirm).not.toHaveBeenCalled();
  });

  it('disables the destructive action while the delete is pending', () => {
    render(
      <LeitwegIdDeleteDialogView
        open
        onOpenChange={vi.fn()}
        tCommon={tCommonStub}
        {...buildHook({ isPending: true })}
      />,
    );

    expect(screen.getByTestId('leitweg-delete-confirm')).toBeDisabled();
  });
});
