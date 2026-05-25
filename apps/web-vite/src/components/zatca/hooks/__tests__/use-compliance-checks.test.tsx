/**
 * `useComplianceChecks` — step 4 of the ZATCA onboarding wizard. Covers the
 * empty results baseline, success path with all 6 ZATCA checks passing
 * (allPassed=true, progress=100, success toast), the partial-failure path
 * (allPassed=false, error toast with failedCount), and the upstream-error
 * fallback (toast.error, no results captured).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useComplianceChecks } from '../use-compliance-checks.js';

const trpcProxy = createTRPCProxy();

const ALL_CLEARED = [
  { type: 't1', invoiceTypeCode: '388', subtype: 'standard', status: 'CLEARED' as const },
  { type: 't2', invoiceTypeCode: '381', subtype: 'standard', status: 'CLEARED' as const },
  { type: 't3', invoiceTypeCode: '383', subtype: 'standard', status: 'CLEARED' as const },
  { type: 't4', invoiceTypeCode: '388', subtype: 'simplified', status: 'REPORTED' as const },
  { type: 't5', invoiceTypeCode: '381', subtype: 'simplified', status: 'REPORTED' as const },
  { type: 't6', invoiceTypeCode: '383', subtype: 'simplified', status: 'REPORTED' as const },
];

describe('useComplianceChecks', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    setTRPCMock({});
  });

  it('starts empty (no results, isPending=false, allPassed=false)', () => {
    const { result } = renderHookWithProviders(() => useComplianceChecks());
    expect(result.current.results).toEqual([]);
    expect(result.current.isPending).toBe(false);
    expect(result.current.allPassed).toBe(false);
    expect(result.current.progressValue).toBe(0);
    expect(result.current.testLabels).toHaveLength(6);
  });

  it('captures results, flips allPassed=true, and toasts success when all 6 checks pass', async () => {
    setTRPCMock({
      'zatca.runComplianceChecks': () => ALL_CLEARED,
    });
    const { result } = renderHookWithProviders(() => useComplianceChecks());

    await act(async () => {
      result.current.runChecks();
    });

    await waitFor(() => expect(result.current.allPassed).toBe(true));
    expect(result.current.results).toHaveLength(6);
    expect(result.current.completedCount).toBe(6);
    expect(result.current.progressValue).toBe(100);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('reports a partial failure (allPassed=false, error toast with failed count)', async () => {
    const mixed = [
      ...ALL_CLEARED.slice(0, 5),
      { type: 't6', invoiceTypeCode: '383', subtype: 'simplified', status: 'REJECTED' as const },
    ];
    setTRPCMock({
      'zatca.runComplianceChecks': () => mixed,
    });
    const { result } = renderHookWithProviders(() => useComplianceChecks());

    await act(async () => {
      result.current.runChecks();
    });

    await waitFor(() => expect(result.current.results).toHaveLength(6));
    expect(result.current.allPassed).toBe(false);
    expect(toastError).toHaveBeenCalled();
  });

  it('emits an error toast and captures no results when the mutation rejects', async () => {
    setTRPCMock({
      'zatca.runComplianceChecks': () => {
        throw new Error('ZATCA sandbox unavailable');
      },
    });
    const { result } = renderHookWithProviders(() => useComplianceChecks());

    await act(async () => {
      result.current.runChecks();
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(result.current.results).toEqual([]);
    expect(result.current.allPassed).toBe(false);
  });
});
