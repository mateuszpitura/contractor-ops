import { describe, expect, it, vi } from 'vitest';

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from './_render-hook.js';

vi.mock('../../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const { useDirectoryImportWizard } = await import('../use-directory-import-wizard.js');

const baseParams = { open: true, onOpenChange: () => undefined };

describe('useDirectoryImportWizard', () => {
  it('loading: directory query pending', () => {
    setTRPCMock({ 'googleWorkspace.listDirectory': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => useDirectoryImportWizard(baseParams));
    expect(result.current.directoryQuery.isLoading).toBe(true);
    expect(result.current.users).toEqual([]);
    expect(result.current.step).toBe(1);
    clearTRPCMock();
  });

  it('empty: empty users list resolves cleanly', async () => {
    setTRPCMock({
      'googleWorkspace.listDirectory': () => ({ users: [], stats: { total: 0 } }),
    });
    const { result } = renderHookWithProviders(() => useDirectoryImportWizard(baseParams));
    await waitFor(() => expect(result.current.directoryQuery.isLoading).toBe(false));
    expect(result.current.users).toEqual([]);
    clearTRPCMock();
  });

  it('error: directory query failure leaves users []', async () => {
    setTRPCMock({
      'googleWorkspace.listDirectory': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useDirectoryImportWizard(baseParams));
    await waitFor(() => expect(result.current.directoryQuery.isError).toBe(true));
    expect(result.current.users).toEqual([]);
    clearTRPCMock();
  });

  it('success: bulkImport fully succeeds, toast fires, dialog closes', async () => {
    toastSuccess.mockReset();
    const onOpenChange = vi.fn();
    const importCalls: unknown[] = [];
    setTRPCMock({
      'googleWorkspace.listDirectory': () => ({
        users: [
          {
            id: 'u1',
            primaryEmail: 'a@example.com',
            name: { fullName: 'Alice', givenName: 'Alice', familyName: 'X' },
          },
        ],
        stats: { total: 1 },
      }),
      'googleWorkspace.listUserGroups': () => ({ groups: [] }),
      'googleWorkspace.bulkImport': vars => {
        importCalls.push(vars);
        return { succeeded: [{ email: 'a@example.com' }], failed: [] };
      },
    });
    const { result } = renderHookWithProviders(() =>
      useDirectoryImportWizard({ ...baseParams, onOpenChange }),
    );
    await waitFor(() => expect(result.current.users.length).toBe(1));
    act(() => result.current.setSelectedEmails(new Set(['a@example.com'])));
    act(() => result.current.handleConfirmImport());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(importCalls).toHaveLength(1);
    clearTRPCMock();
  });

  it('partial failure: shows error toast and does not close', async () => {
    toastError.mockReset();
    const onOpenChange = vi.fn();
    setTRPCMock({
      'googleWorkspace.listDirectory': () => ({
        users: [
          {
            id: 'u1',
            primaryEmail: 'a@example.com',
            name: { fullName: 'Alice', givenName: 'Alice', familyName: 'X' },
          },
        ],
        stats: { total: 1 },
      }),
      'googleWorkspace.listUserGroups': () => ({ groups: [] }),
      'googleWorkspace.bulkImport': () => ({
        succeeded: [],
        failed: [{ email: 'a@example.com', error: 'oops' }],
      }),
    });
    const { result } = renderHookWithProviders(() =>
      useDirectoryImportWizard({ ...baseParams, onOpenChange }),
    );
    await waitFor(() => expect(result.current.users.length).toBe(1));
    act(() => result.current.setSelectedEmails(new Set(['a@example.com'])));
    act(() => result.current.handleConfirmImport());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalled();
    clearTRPCMock();
  });

  it('handleOpenChange(false) resets local state', () => {
    setTRPCMock({
      'googleWorkspace.listDirectory': () => ({ users: [], stats: { total: 0 } }),
    });
    const onOpenChange = vi.fn();
    const { result } = renderHookWithProviders(() =>
      useDirectoryImportWizard({ open: true, onOpenChange }),
    );
    act(() => result.current.setStep(2));
    act(() => result.current.setSelectedEmails(new Set(['x'])));
    act(() => result.current.handleOpenChange(false));
    expect(result.current.step).toBe(1);
    expect(result.current.selectedEmails.size).toBe(0);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    clearTRPCMock();
  });
});
