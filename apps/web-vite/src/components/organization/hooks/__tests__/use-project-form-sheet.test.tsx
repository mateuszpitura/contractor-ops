/**
 * Hook spec for `useProjectFormSheet` — exposes the active-teams option
 * list plus create / update / archive project mutations. Each success
 * path toasts, invalidates the project list, runs `onCreated` for the
 * create case, and closes the sheet via `onOpenChange(false)`.
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
import { useProjectFormSheet } from '../use-project-form-sheet.js';

const trpcProxy = createTRPCProxy();

describe('useProjectFormSheet', () => {
  it('starts with empty teams while team.list is pending', () => {
    setTRPCMock({
      'organizationDefinitions.team.list': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() =>
      useProjectFormSheet({ onOpenChange: () => undefined }),
    );
    expect(result.current.teams).toEqual([]);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('exposes teams list from team.list query (success)', async () => {
    setTRPCMock({
      'organizationDefinitions.team.list': () => ({
        items: [
          { id: 't1', name: 'Alpha' },
          { id: 't2', name: 'Beta' },
        ],
      }),
    });
    const { result } = renderHookWithProviders(() =>
      useProjectFormSheet({ onOpenChange: () => undefined }),
    );
    await waitFor(() => expect(result.current.teams).toHaveLength(2));
    expect(result.current.teams.map(t => t.id)).toEqual(['t1', 't2']);
  });

  it('keeps teams empty when team.list errors', async () => {
    setTRPCMock({
      'organizationDefinitions.team.list': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useProjectFormSheet({ onOpenChange: () => undefined }),
    );
    await waitFor(() => expect(result.current.teams).toEqual([]));
  });

  it('create success: toast + onCreated + onOpenChange(false)', async () => {
    toastSuccess.mockClear();
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();
    setTRPCMock({
      'organizationDefinitions.team.list': () => ({ items: [] }),
      'organizationDefinitions.project.create': () => ({ id: 'p9', name: 'Mig' }),
    });
    const { result } = renderHookWithProviders(() =>
      useProjectFormSheet({ onOpenChange, onCreated }),
    );
    act(() => {
      result.current.createMutation.mutate({ name: 'Mig' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Project created'));
    expect(onCreated).toHaveBeenCalledWith({ id: 'p9', name: 'Mig' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('update success: toast + sheet closes; no onCreated', async () => {
    toastSuccess.mockClear();
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();
    setTRPCMock({
      'organizationDefinitions.team.list': () => ({ items: [] }),
      'organizationDefinitions.project.update': () => ({ id: 'p1' }),
    });
    const { result } = renderHookWithProviders(() =>
      useProjectFormSheet({ onOpenChange, onCreated }),
    );
    act(() => {
      result.current.updateMutation.mutate({ id: 'p1', name: 'X' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Project updated'));
    expect(onCreated).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('archive success: toast + sheet closes', async () => {
    toastSuccess.mockClear();
    const onOpenChange = vi.fn();
    setTRPCMock({
      'organizationDefinitions.team.list': () => ({ items: [] }),
      'organizationDefinitions.project.archive': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => useProjectFormSheet({ onOpenChange }));
    act(() => {
      result.current.archiveMutation.mutate({ id: 'p1' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Project archived'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('create error: error toast surfaces; sheet stays open', async () => {
    toastError.mockClear();
    const onOpenChange = vi.fn();
    setTRPCMock({
      'organizationDefinitions.team.list': () => ({ items: [] }),
      'organizationDefinitions.project.create': () => {
        throw new Error('budget invalid');
      },
    });
    const { result } = renderHookWithProviders(() => useProjectFormSheet({ onOpenChange }));
    act(() => {
      result.current.createMutation.mutate({ name: 'X' });
    });
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('budget invalid'));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
