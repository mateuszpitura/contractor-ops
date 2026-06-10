/**
 * Hook spec for `useTeamFormSheet` — create / update / archive team
 * mutations. Each success path emits a toast, invalidates the team list,
 * fires the `onCreated` callback (create only), and closes the sheet.
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
import { useTeamFormSheet } from '../use-team-form-sheet.js';

const trpcProxy = createTRPCProxy();

describe('useTeamFormSheet', () => {
  it('exposes idle mutations and isSubmitting=false initially', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() =>
      useTeamFormSheet({ onOpenChange: () => undefined }),
    );
    expect(result.current.createMutation.isPending).toBe(false);
    expect(result.current.updateMutation.isPending).toBe(false);
    expect(result.current.archiveMutation.isPending).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('create success: toast + onCreated + onOpenChange(false)', async () => {
    toastSuccess.mockClear();
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();
    setTRPCMock({
      'organizationDefinitions.team.create': () => ({ id: 't9', name: 'Platform' }),
    });
    const { result } = renderHookWithProviders(() => useTeamFormSheet({ onOpenChange, onCreated }));
    act(() => {
      result.current.createMutation.mutate({ name: 'Platform' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Team created.'));
    expect(onCreated).toHaveBeenCalledWith({ id: 't9', name: 'Platform' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('update success: toast + sheet closes; no onCreated fired', async () => {
    toastSuccess.mockClear();
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();
    setTRPCMock({
      'organizationDefinitions.team.update': () => ({ id: 't1' }),
    });
    const { result } = renderHookWithProviders(() => useTeamFormSheet({ onOpenChange, onCreated }));
    act(() => {
      result.current.updateMutation.mutate({ id: 't1', name: 'X' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Team updated.'));
    expect(onCreated).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('archive success: toast + sheet closes', async () => {
    toastSuccess.mockClear();
    const onOpenChange = vi.fn();
    setTRPCMock({
      'organizationDefinitions.team.archive': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => useTeamFormSheet({ onOpenChange }));
    act(() => {
      result.current.archiveMutation.mutate({ id: 't1' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Team archived.'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('create error: error toast, sheet stays open', async () => {
    toastError.mockClear();
    const onOpenChange = vi.fn();
    setTRPCMock({
      'organizationDefinitions.team.create': () => {
        throw new Error('duplicate');
      },
    });
    const { result } = renderHookWithProviders(() => useTeamFormSheet({ onOpenChange }));
    act(() => {
      result.current.createMutation.mutate({ name: 'X' });
    });
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Something went wrong. Please try again.'),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
