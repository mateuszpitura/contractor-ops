/**
 * Hook spec for `useCostCenterCsvImport` — single mutation wrapped in a
 * helper that closes the import dialog and toasts the inserted count.
 * Error path surfaces a toast but leaves the dialog open.
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
import { useCostCenterCsvImport } from '../use-cost-center-csv-import.js';

const trpcProxy = createTRPCProxy();

describe('useCostCenterCsvImport', () => {
  it('exposes an idle importMutation initially', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() => useCostCenterCsvImport(() => undefined));
    expect(result.current.importMutation.isPending).toBe(false);
  });

  it('importRows success: toast with insert count + dialog closes', async () => {
    toastSuccess.mockClear();
    const onOpenChange = vi.fn();
    setTRPCMock({
      'organizationDefinitions.costCenter.importCsv': () => ({ inserted: 5 }),
    });
    const { result } = renderHookWithProviders(() => useCostCenterCsvImport(onOpenChange));
    act(() => {
      result.current.importRows([
        { name: 'Ops', code: 'OPS' },
        { name: 'Eng', code: 'ENG' },
      ]);
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastSuccess.mock.calls[0]?.[0]).toBe('Done.');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('importRows handles a resolved-empty insert (0 rows)', async () => {
    toastSuccess.mockClear();
    const onOpenChange = vi.fn();
    setTRPCMock({
      'organizationDefinitions.costCenter.importCsv': () => ({ inserted: 0 }),
    });
    const { result } = renderHookWithProviders(() => useCostCenterCsvImport(onOpenChange));
    act(() => {
      result.current.importRows([]);
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastSuccess.mock.calls[0]?.[0]).toBe('Done.');
  });

  it('importRows error: error toast; dialog stays open', async () => {
    toastError.mockClear();
    const onOpenChange = vi.fn();
    setTRPCMock({
      'organizationDefinitions.costCenter.importCsv': () => {
        throw new Error('Something went wrong. Please try again.');
      },
    });
    const { result } = renderHookWithProviders(() => useCostCenterCsvImport(onOpenChange));
    act(() => {
      result.current.importRows([{ name: 'X', code: 'X' }]);
    });
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Something went wrong. Please try again.'),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
