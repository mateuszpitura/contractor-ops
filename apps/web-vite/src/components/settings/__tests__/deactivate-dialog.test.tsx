/**
 * Container/component split: the component receives the hook return value
 * (`t`, `isPending`, `handleConfirm`) as props, so the test passes a
 * shaped stub and exercises the presentational surface — no tRPC harness
 * or react-query mocking needed.
 *
 * Assertions use the i18n keys returned by the stub `t`, mirroring the
 * canonical Leitweg-ID row pattern in this directory.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import { DeactivateDialog } from '../deactivate-dialog';
import type { useDeactivateDialog } from '../hooks/use-deactivate-dialog';

type HookReturn = ReturnType<typeof useDeactivateDialog>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    t: tStub,
    isPending: false,
    handleConfirm: vi.fn(),
    ...overrides,
  } as HookReturn;
}

describe('DeactivateDialog', () => {
  it('renders title, body and CTAs when open', () => {
    render(
      <DeactivateDialog open onOpenChange={vi.fn()} userId="u1" userName="John" {...buildHook()} />,
    );

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
    expect(screen.getByText('cta')).toBeInTheDocument();
    expect(screen.getByText('cancel')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(
      <DeactivateDialog
        open={false}
        onOpenChange={vi.fn()}
        userId="u1"
        userName="John"
        {...buildHook()}
      />,
    );

    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('renders the pending label and disables CTAs while isPending', () => {
    render(
      <DeactivateDialog
        open
        onOpenChange={vi.fn()}
        userId="u1"
        userName="John"
        {...buildHook({ isPending: true })}
      />,
    );

    expect(screen.getByText('deactivating')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /deactivating/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('invokes handleConfirm when the destructive button is clicked', async () => {
    const handleConfirm = vi.fn();
    const { user } = setup(
      <DeactivateDialog
        open
        onOpenChange={vi.fn()}
        userId="u1"
        userName="John"
        {...buildHook({ handleConfirm })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /cta/i }));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });
});
