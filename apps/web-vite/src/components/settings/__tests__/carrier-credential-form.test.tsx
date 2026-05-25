/**
 * Web-vite port of apps/web/src/components/settings/__tests__/carrier-credential-form.test.tsx.
 *
 * Container/component split. The form receives `t`, both credential
 * state pairs (dpd + ups), and save/test handlers from
 * `useCarrierCredentialForm`. Tests inject shaped stubs.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import { CarrierCredentialForm } from '../carrier-credential-form';
import type { useCarrierCredentialForm } from '../hooks/use-carrier-credential-form';

type HookReturn = ReturnType<typeof useCarrierCredentialForm>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    id: 'cc',
    t: tStub,
    carrier: 'dpd',
    isConnected: false,
    dpdCreds: { username: '', password: '', fid: '', sandbox: false },
    setDpdCreds: vi.fn(),
    upsCreds: { clientId: '', clientSecret: '', accountNumber: '', sandbox: false },
    setUpsCreds: vi.fn(),
    handleSave: vi.fn(),
    handleTest: vi.fn(),
    isPending: false,
    isTestPending: false,
    isSavePending: false,
    ...overrides,
  } as HookReturn;
}

describe('CarrierCredentialForm (DPD)', () => {
  it('renders DPD username, password, fid fields and the sandbox checkbox', () => {
    render(<CarrierCredentialForm carrierLabel="DPD" {...buildHook({ carrier: 'dpd' })} />);

    expect(screen.getByText('DPD')).toBeInTheDocument();
    expect(screen.getByText('username')).toBeInTheDocument();
    expect(screen.getByText('password')).toBeInTheDocument();
    expect(screen.getByText('fid')).toBeInTheDocument();
    expect(screen.getByText('sandbox')).toBeInTheDocument();
  });

  it('renders the notConfigured badge when isConnected is false', () => {
    render(
      <CarrierCredentialForm
        carrierLabel="DPD"
        {...buildHook({ carrier: 'dpd', isConnected: false })}
      />,
    );

    expect(screen.getByText('notConfigured')).toBeInTheDocument();
  });

  it('renders the connected badge when isConnected is true', () => {
    render(
      <CarrierCredentialForm
        carrierLabel="DPD"
        {...buildHook({ carrier: 'dpd', isConnected: true })}
      />,
    );

    expect(screen.getByText('connected')).toBeInTheDocument();
  });

  it('fires handleSave and handleTest when their buttons are clicked', async () => {
    const handleSave = vi.fn();
    const handleTest = vi.fn();
    const { user } = setup(
      <CarrierCredentialForm
        carrierLabel="DPD"
        {...buildHook({ carrier: 'dpd', handleSave, handleTest })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'testConnection' }));
    await user.click(screen.getByRole('button', { name: 'saveCredentials' }));

    expect(handleTest).toHaveBeenCalledTimes(1);
    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while any mutation is pending', () => {
    render(
      <CarrierCredentialForm
        carrierLabel="DPD"
        {...buildHook({ carrier: 'dpd', isPending: true })}
      />,
    );

    expect(screen.getByRole('button', { name: 'testConnection' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'saveCredentials' })).toBeDisabled();
  });
});

describe('CarrierCredentialForm (UPS)', () => {
  it('renders UPS clientId, clientSecret and accountNumber fields', () => {
    render(<CarrierCredentialForm carrierLabel="UPS" {...buildHook({ carrier: 'ups' })} />);

    expect(screen.getByText('UPS')).toBeInTheDocument();
    expect(screen.getByText('clientId')).toBeInTheDocument();
    expect(screen.getByText('clientSecret')).toBeInTheDocument();
    expect(screen.getByText('accountNumber')).toBeInTheDocument();
  });
});
