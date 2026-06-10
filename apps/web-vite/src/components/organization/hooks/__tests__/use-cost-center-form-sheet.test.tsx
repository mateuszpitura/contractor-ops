/**
 * Hook spec for `useCostCenterFormSheet` — create / update / archive
 * cost-center mutations. Mirrors the team form sheet — each success path
 * toasts, invalidates the list, fires `onCreated` (create only), and
 * closes the sheet.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useCostCenterFormSheet } from '../use-cost-center-form-sheet.js';

const trpcProxy = createTRPCProxy();

describe('useCostCenterFormSheet', () => {
  it('starts idle with isSubmitting=false', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() =>
      useCostCenterFormSheet({ onOpenChange: () => undefined }),
    );
    expect(result.current.isSubmitting).toBe(false);
  });

  it('create success: toast + onCreated + onOpenChange(false)', async () => {
    toastSuccess.mockClear();
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();
    setTRPCMock({
      'organizationDefinitions.costCenter.create': () => ({ id: 'cc1', name: 'OPS' }),
    });
    const { result } = renderHookWithProviders(() =>
      useCostCenterFormSheet({ onOpenChange, onCreated }),
    );
    act(() => {
      result.current.createMutation.mutate({ name: 'OPS', code: 'OPS' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Cost center created.'));
    expect(onCreated).toHaveBeenCalledWith({ id: 'cc1', name: 'OPS' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('update success: toast + sheet closes; no onCreated', async () => {
    toastSuccess.mockClear();
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();
    setTRPCMock({
      'organizationDefinitions.costCenter.update': () => ({ id: 'cc1' }),
    });
    const { result } = renderHookWithProviders(() =>
      useCostCenterFormSheet({ onOpenChange, onCreated }),
    );
    act(() => {
      result.current.updateMutation.mutate({ id: 'cc1', name: 'X', code: 'X' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Cost center updated.'));
    expect(onCreated).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('archive success: toast + sheet closes', async () => {
    toastSuccess.mockClear();
    const onOpenChange = vi.fn();
    setTRPCMock({
      'organizationDefinitions.costCenter.archive': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => useCostCenterFormSheet({ onOpenChange }));
    act(() => {
      result.current.archiveMutation.mutate({ id: 'cc1' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Cost center archived.'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('update error: error toast; sheet does not close', async () => {
    toastError.mockClear();
    const onOpenChange = vi.fn();
    setTRPCMock({
      'organizationDefinitions.costCenter.update': () => {
        throw new Error('Something went wrong. Please try again.');
      },
    });
    const { result } = renderHookWithProviders(() => useCostCenterFormSheet({ onOpenChange }));
    act(() => {
      result.current.updateMutation.mutate({ id: 'cc1', name: 'X', code: 'X' });
    });
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Something went wrong. Please try again.'),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
