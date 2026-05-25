import { describe, expect, it, vi } from 'vitest';

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from './render-portal-hook.js';

vi.mock('../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { usePortalSettingsPage } = await import('../hooks/use-portal-settings-page.js');

const PROFILE = {
  displayName: 'Jan Kowalski',
  email: 'jan@example.com',
  phone: '+48 123 456 789',
  addressLine1: 'Ul. Marszałkowska 1',
  addressLine2: null,
  city: 'Warszawa',
  postalCode: '00-001',
  countryCode: 'PL',
  billingProfile: {
    bankAccountMasked: '****1234',
    bankName: 'mBank',
    swiftBic: 'BREXPLPW',
    taxId: '5555555555',
  },
  pendingChangeRequest: null,
};

describe('usePortalSettingsPage', () => {
  it('loading: starts pending and empty fields', () => {
    setTRPCMock({
      'portal.getProfile': () => new Promise(() => undefined),
      'portal.updateContactInfo': () => ({}),
      'portal.submitFinancialChangeRequest': () => ({}),
    });
    const { result } = renderHookWithProviders(() => usePortalSettingsPage());
    expect(result.current.isPending).toBe(true);
    expect(result.current.personalFields).toEqual([]);
    expect(result.current.financialFields).toEqual([]);
    clearTRPCMock();
  });

  it('empty: missing profile still returns empty field arrays', async () => {
    setTRPCMock({
      'portal.getProfile': () => null,
      'portal.updateContactInfo': () => ({}),
      'portal.submitFinancialChangeRequest': () => ({}),
    });
    const { result } = renderHookWithProviders(() => usePortalSettingsPage());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.personalFields).toEqual([]);
    expect(result.current.financialFields).toEqual([]);
    clearTRPCMock();
  });

  it('error: query error keeps fields empty', async () => {
    setTRPCMock({
      'portal.getProfile': () => {
        throw new Error('boom');
      },
      'portal.updateContactInfo': () => ({}),
      'portal.submitFinancialChangeRequest': () => ({}),
    });
    const { result } = renderHookWithProviders(() => usePortalSettingsPage());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.personalFields).toEqual([]);
    clearTRPCMock();
  });

  it('success: derives personal + financial field bags from profile', async () => {
    setTRPCMock({
      'portal.getProfile': () => PROFILE,
      'portal.updateContactInfo': () => ({ ok: true }),
      'portal.submitFinancialChangeRequest': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => usePortalSettingsPage());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.personalFields.find(f => f.key === 'displayName')?.value).toBe(
      'Jan Kowalski',
    );
    const email = result.current.personalFields.find(f => f.key === 'email');
    expect(email?.readOnly).toBe(true);
    expect(result.current.financialFields.find(f => f.key === 'bankName')?.value).toBe('mBank');
    clearTRPCMock();
  });

  it('onContactSave: passes nullable fields cleanly to update mutation', async () => {
    const updateSpy = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'portal.getProfile': () => PROFILE,
      'portal.updateContactInfo': updateSpy,
      'portal.submitFinancialChangeRequest': () => ({}),
    });
    const { result } = renderHookWithProviders(() => usePortalSettingsPage());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    await act(async () => {
      await result.current.onContactSave({
        displayName: 'Anna',
        phone: '',
        addressLine1: null,
        addressLine2: 'Suite 4',
        city: 'Kraków',
        postalCode: '30-001',
        countryCode: 'PL',
      });
    });
    expect(updateSpy).toHaveBeenCalledWith({
      displayName: 'Anna',
      phone: null,
      addressLine1: null,
      addressLine2: 'Suite 4',
      city: 'Kraków',
      postalCode: '30-001',
      countryCode: 'PL',
    });
    clearTRPCMock();
  });

  it('onFinancialSave: empty values are dropped to undefined', async () => {
    const financialSpy = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'portal.getProfile': () => PROFILE,
      'portal.updateContactInfo': () => ({}),
      'portal.submitFinancialChangeRequest': financialSpy,
    });
    const { result } = renderHookWithProviders(() => usePortalSettingsPage());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    await act(async () => {
      await result.current.onFinancialSave({
        bankAccountNumber: 'PL61109010140000071219812874',
        bankName: '',
        swiftBic: null,
        taxId: '1234567890',
      });
    });
    expect(financialSpy).toHaveBeenCalledWith({
      bankAccountNumber: 'PL61109010140000071219812874',
      bankName: undefined,
      swiftBic: undefined,
      taxId: '1234567890',
    });
    clearTRPCMock();
  });
});
