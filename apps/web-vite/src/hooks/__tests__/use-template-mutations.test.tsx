/**
 * `useTemplateMutations` — wraps workflow template CRUD in toast-on-resolve
 * semantics keyed off the translator passed in by the caller. Exercises the
 * happy path + error path against the shared tRPC proxy harness.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../providers/trpc-provider.js', () => ({
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
} from '../../test-utils/render-hook.js';
import { useTemplateMutations } from '../use-template-mutations.js';

const trpcProxy = createTRPCProxy();
const mockT = vi.fn((key: string) => key);

describe('useTemplateMutations', () => {
  it('starts with isPending = false and exposes all four mutations', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() => useTemplateMutations(mockT));
    expect(result.current.isPending).toBe(false);
    expect(typeof result.current.activate).toBe('function');
    expect(typeof result.current.archive).toBe('function');
    expect(typeof result.current.duplicate).toBe('function');
    expect(typeof result.current.deleteTemplate).toBe('function');
  });

  it('activate calls updateTemplate with status ACTIVE and emits success toast', async () => {
    toastSuccess.mockClear();
    const handler = vi.fn(() => ({ ok: true }));
    setTRPCMock({ 'workflow.updateTemplate': handler });
    const { result } = renderHookWithProviders(() => useTemplateMutations(mockT));
    await act(async () => {
      await result.current.activate('tpl-1');
    });
    expect(handler).toHaveBeenCalledWith({ id: 'tpl-1', status: 'ACTIVE' });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('toast.templateActivated'));
  });

  it('archive calls updateTemplate with status ARCHIVED', async () => {
    toastSuccess.mockClear();
    const handler = vi.fn(() => ({ ok: true }));
    setTRPCMock({ 'workflow.updateTemplate': handler });
    const { result } = renderHookWithProviders(() => useTemplateMutations(mockT));
    await act(async () => {
      await result.current.archive('tpl-2');
    });
    expect(handler).toHaveBeenCalledWith({ id: 'tpl-2', status: 'ARCHIVED' });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('toast.templateArchived'));
  });

  it('duplicate calls duplicateTemplate and emits success toast', async () => {
    toastSuccess.mockClear();
    const handler = vi.fn(() => ({ ok: true }));
    setTRPCMock({ 'workflow.duplicateTemplate': handler });
    const { result } = renderHookWithProviders(() => useTemplateMutations(mockT));
    await act(async () => {
      await result.current.duplicate('tpl-3');
    });
    expect(handler).toHaveBeenCalledWith({ id: 'tpl-3' });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('toast.templateDuplicated'));
  });

  it('deleteTemplate calls deleteTemplate and emits success toast', async () => {
    toastSuccess.mockClear();
    const handler = vi.fn(() => ({ ok: true }));
    setTRPCMock({ 'workflow.deleteTemplate': handler });
    const { result } = renderHookWithProviders(() => useTemplateMutations(mockT));
    await act(async () => {
      await result.current.deleteTemplate('tpl-4');
    });
    expect(handler).toHaveBeenCalledWith({ id: 'tpl-4' });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('toast.templateDeleted'));
  });

  it('emits localized error toast when activate rejects', async () => {
    toastError.mockClear();
    setTRPCMock({
      'workflow.updateTemplate': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useTemplateMutations(mockT));
    await act(async () => {
      await result.current.activate('tpl-x');
    });
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('errors.failedToSaveTemplate'));
  });
});
