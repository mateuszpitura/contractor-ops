/**
 * Container/component split. The dialog receives all KSeF setup state +
 * handlers from `useKsefSetupDialog`. Tests inject shaped stubs and
 * assert on the open-state surface, tab switch, save-disable logic.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { useKsefSetupDialog } from '../hooks/use-ksef-setup-dialog';
import { KsefSetupDialogView } from '../ksef-setup-dialog';

type HookReturn = ReturnType<typeof useKsefSetupDialog>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    id: 'ksef',
    t: tStub,
    authMethod: 'token',
    setAuthMethod: vi.fn(),
    token: '',
    setToken: vi.fn(),
    certificateFile: null,
    setCertificateFile: vi.fn(),
    certificatePassword: '',
    setCertificatePassword: vi.fn(),
    isFormDisabled: false,
    isSaveDisabled: true,
    resetAndClose: vi.fn(),
    handleSave: vi.fn(),
    isPending: false,
    ...overrides,
  } as HookReturn;
}

describe('KsefSetupDialogView', () => {
  it('renders title, description and NIP helper when open with an orgNip', () => {
    render(
      <KsefSetupDialogView open onOpenChange={vi.fn()} orgNip="1234567890" {...buildHook()} />,
    );

    expect(screen.getByText('connectTitle')).toBeInTheDocument();
    expect(screen.getByText('connectDescription')).toBeInTheDocument();
    expect(screen.getByText('orgNipHelper')).toBeInTheDocument();
    const nipInput = screen.getByLabelText('orgNipLabel') as HTMLInputElement;
    expect(nipInput.value).toBe('1234567890');
    expect(nipInput.disabled).toBe(true);
  });

  it('shows the orgNipMissing warning when orgNip is null', () => {
    render(<KsefSetupDialogView open onOpenChange={vi.fn()} orgNip={null} {...buildHook()} />);
    expect(screen.getByText('orgNipMissing')).toBeInTheDocument();
  });

  it('disables the save button when isSaveDisabled is true', () => {
    render(
      <KsefSetupDialogView
        open
        onOpenChange={vi.fn()}
        orgNip="123"
        {...buildHook({ isSaveDisabled: true })}
      />,
    );

    expect(screen.getByRole('button', { name: 'saveCredentials' })).toBeDisabled();
  });

  it('shows the spinner while isPending', () => {
    render(
      <KsefSetupDialogView
        open
        onOpenChange={vi.fn()}
        orgNip="123"
        {...buildHook({ isPending: true })}
      />,
    );

    // The dialog content is portalled; query the whole document body.
    expect(document.body.querySelector('.animate-spin')).not.toBeNull();
  });

  it('fires resetAndClose when the discard button is clicked', async () => {
    const resetAndClose = vi.fn();
    const { user } = setup(
      <KsefSetupDialogView
        open
        onOpenChange={vi.fn()}
        orgNip="123"
        {...buildHook({ resetAndClose })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'discard' }));
    expect(resetAndClose).toHaveBeenCalledTimes(1);
  });

  it('forwards token input changes via setToken', async () => {
    const setToken = vi.fn();
    const { user } = setup(
      <KsefSetupDialogView open onOpenChange={vi.fn()} orgNip="123" {...buildHook({ setToken })} />,
    );

    // tokenLabel appears twice (tab trigger + textarea label) — pick the
    // textarea by its id.
    const tokenInput = document.getElementById('ksef-ksef-token') as HTMLTextAreaElement;
    expect(tokenInput).not.toBeNull();
    await user.type(tokenInput, 'A');
    expect(setToken).toHaveBeenCalledWith('A');
  });

  it('does not render dialog body when closed', () => {
    render(
      <KsefSetupDialogView open={false} onOpenChange={vi.fn()} orgNip="123" {...buildHook()} />,
    );

    expect(screen.queryByText('connectTitle')).not.toBeInTheDocument();
  });
});
