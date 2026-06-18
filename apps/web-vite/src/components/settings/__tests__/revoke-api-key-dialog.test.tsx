/**
 * Confirm-gate coverage for the revoke-API-key destructive dialog.
 *
 * RevokeKeyDialogView receives `handleRevoke` (the mutation trigger) from its
 * hook as a prop, so the test passes a spy and asserts the revoke mutation
 * fires only after the explicit destructive action — never on render. A
 * stubbed `t`/`tCommon` echo i18n keys so assertions survive copy churn.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { useRevokeKeyDialog } from '../hooks/use-api-keys-tab';
import { RevokeKeyDialogView } from '../revoke-api-key-dialog';

type HookReturn = ReturnType<typeof useRevokeKeyDialog>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    t: tStub,
    tCommon: tStub,
    isPending: false,
    handleRevoke: vi.fn(),
    ...overrides,
  } as HookReturn;
}

describe('RevokeKeyDialogView', () => {
  it('renders title, description and CTAs when open', () => {
    render(
      <RevokeKeyDialogView
        keyId="key-1"
        keyName="ERP Integration"
        open
        onOpenChange={vi.fn()}
        {...buildHook()}
      />,
    );

    expect(screen.getByText('revokeDialog.title')).toBeInTheDocument();
    expect(screen.getByText('revokeDialog.confirmButton')).toBeInTheDocument();
    expect(screen.getByText('cancel')).toBeInTheDocument();
  });

  it('does not render destructive content when closed', () => {
    render(
      <RevokeKeyDialogView
        keyId="key-1"
        keyName="ERP Integration"
        open={false}
        onOpenChange={vi.fn()}
        {...buildHook()}
      />,
    );

    expect(screen.queryByText('revokeDialog.confirmButton')).not.toBeInTheDocument();
  });

  it('does NOT fire the revoke mutation on render — only on explicit confirm', async () => {
    const handleRevoke = vi.fn();
    const { user } = setup(
      <RevokeKeyDialogView
        keyId="key-1"
        keyName="ERP Integration"
        open
        onOpenChange={vi.fn()}
        {...buildHook({ handleRevoke })}
      />,
    );

    // Mounting the open dialog must not trigger the destructive call.
    expect(handleRevoke).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /revokeDialog\.confirmButton/i }));
    expect(handleRevoke).toHaveBeenCalledTimes(1);
  });

  it('does not fire the revoke mutation when only cancel is clicked', async () => {
    const handleRevoke = vi.fn();
    const { user } = setup(
      <RevokeKeyDialogView
        keyId="key-1"
        keyName="ERP Integration"
        open
        onOpenChange={vi.fn()}
        {...buildHook({ handleRevoke })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(handleRevoke).not.toHaveBeenCalled();
  });

  it('disables the destructive action while the revoke is pending', () => {
    render(
      <RevokeKeyDialogView
        keyId="key-1"
        keyName="ERP Integration"
        open
        onOpenChange={vi.fn()}
        {...buildHook({ isPending: true })}
      />,
    );

    expect(screen.getByRole('button', { name: /revokeDialog\.confirmButton/i })).toBeDisabled();
  });
});
