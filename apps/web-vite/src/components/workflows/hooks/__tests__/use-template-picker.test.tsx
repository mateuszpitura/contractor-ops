/**
 * `useTemplatePicker` — workflow start dialog.
 * Covers: loading, empty templates, success (with type filter),
 * canStart gating, mutation success (toast + close), mutation error.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError, info: toastInfo },
}));

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useTemplatePicker } = await import('../use-template-picker.js');

const sampleTemplate = {
  id: 'tmpl-1',
  name: 'Onboarding',
  type: 'ONBOARDING',
  description: 'Brings folks aboard',
  _count: { tasks: 3 },
};

describe('useTemplatePicker', () => {
  it('reports loading while the templates query is pending', () => {
    setTRPCMock({
      'workflow.listTemplates': () => new Promise(() => undefined),
      'workflowRoles.selectForContractor': () => null,
      'workflow.startRun': () => undefined,
    });
    const { result } = renderHookWithProviders(() =>
      useTemplatePicker({ open: true, onOpenChange: () => undefined, contractorId: 'c1' }),
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.templates).toEqual([]);
    expect(result.current.canStart).toBe(false);
    clearTRPCMock();
  });

  it('returns an empty list when no templates match', async () => {
    setTRPCMock({
      'workflow.listTemplates': () => ({ items: [], total: 0 }),
      'workflowRoles.selectForContractor': () => null,
      'workflow.startRun': () => undefined,
    });
    const { result } = renderHookWithProviders(() =>
      useTemplatePicker({ open: true, onOpenChange: () => undefined, contractorId: 'c1' }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.templates).toEqual([]);
    clearTRPCMock();
  });

  it('applies the type filter to the templates list', async () => {
    setTRPCMock({
      'workflow.listTemplates': () => ({
        items: [
          sampleTemplate,
          { ...sampleTemplate, id: 'tmpl-2', type: 'OFFBOARDING', name: 'Offboarding' },
        ],
      }),
      'workflowRoles.selectForContractor': () => null,
      'workflow.startRun': () => undefined,
    });
    const { result } = renderHookWithProviders(() =>
      useTemplatePicker({
        open: true,
        onOpenChange: () => undefined,
        contractorId: 'c1',
        preFilterType: 'ONBOARDING',
      }),
    );
    await waitFor(() => expect(result.current.templates.length).toBe(1));
    expect(result.current.templates[0]?.type).toBe('ONBOARDING');
    clearTRPCMock();
  });

  it('gates canStart on having a selection + contractor', async () => {
    setTRPCMock({
      'workflow.listTemplates': () => ({ items: [sampleTemplate] }),
      'workflowRoles.selectForContractor': () => null,
      'workflow.startRun': () => undefined,
    });
    const { result } = renderHookWithProviders(() =>
      useTemplatePicker({ open: true, onOpenChange: () => undefined, contractorId: 'c1' }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canStart).toBe(false);
    act(() => result.current.setSelectedId('tmpl-1'));
    await waitFor(() => expect(result.current.canStart).toBe(true));
    clearTRPCMock();
  });

  it('fires success toast and closes the dialog after a successful start', async () => {
    toastSuccess.mockClear();
    const onOpenChange = vi.fn();
    let startCalls = 0;
    setTRPCMock({
      'workflow.listTemplates': () => ({ items: [sampleTemplate] }),
      'workflowRoles.selectForContractor': () => null,
      'workflow.startRun': () => {
        startCalls += 1;
        return { calendarTaskCount: 0 };
      },
    });
    const { result } = renderHookWithProviders(() =>
      useTemplatePicker({ open: true, onOpenChange, contractorId: 'c1' }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setSelectedId('tmpl-1'));
    await act(async () => {
      await result.current.handleStart();
    });
    expect(startCalls).toBe(1);
    expect(toastSuccess).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    clearTRPCMock();
  });

  it('fires error toast when the start mutation fails', async () => {
    toastError.mockClear();
    setTRPCMock({
      'workflow.listTemplates': () => ({ items: [sampleTemplate] }),
      'workflowRoles.selectForContractor': () => null,
      'workflow.startRun': () => {
        throw new Error('start boom');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useTemplatePicker({ open: true, onOpenChange: () => undefined, contractorId: 'c1' }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setSelectedId('tmpl-1'));
    await act(async () => {
      await result.current.handleStart();
    });
    expect(toastError).toHaveBeenCalled();
    clearTRPCMock();
  });
});
