/**
 * `useCalendarTaskConfig` — calendar event config for a template task.
 * Covers: loading, empty (no config saved), success, toggle saves config,
 * mutation success invalidates and toasts, mutation error toasts.
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

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useCalendarTaskConfig } = await import('../use-calendar-task-config.js');

const sampleConfig = {
  calendarEnabled: true,
  titleTemplate: 'Kickoff with {{contractor}}',
  duration: '1h' as const,
  attendees: ['ada@x.com'],
};

describe('useCalendarTaskConfig', () => {
  it('reports loading while the config query is pending', () => {
    setTRPCMock({
      'calendar.getTaskConfig': () => new Promise(() => undefined),
      'calendar.saveTaskConfig': () => undefined,
    });
    const { result } = renderHookWithProviders(() => useCalendarTaskConfig('task-1'));
    expect(result.current.configQuery.isLoading).toBe(true);
    expect(result.current.config).toBeUndefined();
    expect(result.current.isConfigured).toBe(false);
    clearTRPCMock();
  });

  it('reports not-configured when the API returns no config', async () => {
    setTRPCMock({
      'calendar.getTaskConfig': () => null,
      'calendar.saveTaskConfig': () => undefined,
    });
    const { result } = renderHookWithProviders(() => useCalendarTaskConfig('task-1'));
    await waitFor(() => expect(result.current.configQuery.isLoading).toBe(false));
    expect(result.current.isConfigured).toBe(false);
    clearTRPCMock();
  });

  it('surfaces the config + summary on success', async () => {
    setTRPCMock({
      'calendar.getTaskConfig': () => sampleConfig,
      'calendar.saveTaskConfig': () => undefined,
    });
    const { result } = renderHookWithProviders(() => useCalendarTaskConfig('task-1'));
    await waitFor(() => expect(result.current.isConfigured).toBe(true));
    expect(result.current.summaryText).toContain('Kickoff with');
    clearTRPCMock();
  });

  it('handleToggle persists the new calendarEnabled flag', async () => {
    toastSuccess.mockClear();
    const saveCalls: unknown[] = [];
    setTRPCMock({
      'calendar.getTaskConfig': () => sampleConfig,
      'calendar.saveTaskConfig': (input?: unknown) => {
        saveCalls.push(input);
        return;
      },
    });
    const { result } = renderHookWithProviders(() => useCalendarTaskConfig('task-1'));
    await waitFor(() => expect(result.current.config).toBeDefined());
    await act(async () => {
      result.current.handleToggle(false);
    });
    await waitFor(() => expect(saveCalls.length).toBe(1));
    expect((saveCalls[0] as { config: { calendarEnabled: boolean } }).config.calendarEnabled).toBe(
      false,
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('handleToggle is a no-op until config is loaded', async () => {
    const saveCalls: unknown[] = [];
    setTRPCMock({
      'calendar.getTaskConfig': () => new Promise(() => undefined),
      'calendar.saveTaskConfig': (input?: unknown) => {
        saveCalls.push(input);
        return;
      },
    });
    const { result } = renderHookWithProviders(() => useCalendarTaskConfig('task-1'));
    act(() => result.current.handleToggle(true));
    expect(saveCalls.length).toBe(0);
    clearTRPCMock();
  });

  it('fires an error toast when the save mutation fails', async () => {
    toastError.mockClear();
    setTRPCMock({
      'calendar.getTaskConfig': () => sampleConfig,
      'calendar.saveTaskConfig': () => {
        throw new Error('save boom');
      },
    });
    const { result } = renderHookWithProviders(() => useCalendarTaskConfig('task-1'));
    await waitFor(() => expect(result.current.config).toBeDefined());
    await act(async () => {
      result.current.handleToggle(false);
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });
});
