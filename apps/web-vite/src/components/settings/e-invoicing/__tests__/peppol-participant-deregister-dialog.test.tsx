/**
 * Confirm-gate coverage for the PEPPOL deregister destructive dialog.
 *
 * PeppolParticipantDeregisterDialogView receives `handleConfirm` (the
 * disconnect mutation trigger) from its hook as a prop, so the test passes a
 * spy and asserts the deregister fires only after the explicit destructive
 * action — never on render. Stubbed `t`/`tCommon` echo i18n keys so the
 * destructive and cancel buttons are matched independently of copy.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { usePeppolParticipantDeregisterDialog } from '../hooks/use-peppol-participant-deregister-dialog';
import { PeppolParticipantDeregisterDialogView } from '../peppol-participant-deregister-dialog';

type HookReturn = ReturnType<typeof usePeppolParticipantDeregisterDialog>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];
const tCommonStub = (key: string) => key;

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    t: tStub,
    isPending: false,
    handleConfirm: vi.fn(),
    ...overrides,
  } as HookReturn;
}

describe('PeppolParticipantDeregisterDialogView', () => {
  it('renders the destructive deregister and cancel actions when open', () => {
    render(
      <PeppolParticipantDeregisterDialogView
        open
        onOpenChange={vi.fn()}
        tCommon={tCommonStub}
        {...buildHook()}
      />,
    );

    expect(screen.getByRole('button', { name: /deregisterButton/i })).toBeInTheDocument();
    expect(screen.getByText('cancel')).toBeInTheDocument();
  });

  it('does not render destructive content when closed', () => {
    render(
      <PeppolParticipantDeregisterDialogView
        open={false}
        onOpenChange={vi.fn()}
        tCommon={tCommonStub}
        {...buildHook()}
      />,
    );

    expect(screen.queryByRole('button', { name: /deregisterButton/i })).not.toBeInTheDocument();
  });

  it('does NOT fire the deregister mutation on render — only on explicit confirm', async () => {
    const handleConfirm = vi.fn();
    const { user } = setup(
      <PeppolParticipantDeregisterDialogView
        open
        onOpenChange={vi.fn()}
        tCommon={tCommonStub}
        {...buildHook({ handleConfirm })}
      />,
    );

    expect(handleConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /deregisterButton/i }));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not fire the deregister mutation when only cancel is clicked', async () => {
    const handleConfirm = vi.fn();
    const { user } = setup(
      <PeppolParticipantDeregisterDialogView
        open
        onOpenChange={vi.fn()}
        tCommon={tCommonStub}
        {...buildHook({ handleConfirm })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(handleConfirm).not.toHaveBeenCalled();
  });

  it('disables the destructive action while the deregister is pending', () => {
    render(
      <PeppolParticipantDeregisterDialogView
        open
        onOpenChange={vi.fn()}
        tCommon={tCommonStub}
        {...buildHook({ isPending: true })}
      />,
    );

    expect(screen.getByRole('button', { name: /deregisterButton/i })).toBeDisabled();
  });
});
