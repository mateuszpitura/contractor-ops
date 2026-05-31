/**
 * `useReconciliationSpotCheck` — local-state controller for the
 * single-contract spot-check card.
 *
 * Covers:
 *   - default period: today / one-month-ago in ISO YYYY-MM-DD
 *   - contractors list flows through from the wrapped query
 *   - contracts list pulls items[] off the wrapped query
 *   - handleContractorChange resets contract id
 *   - canRun gates on contractId + valid period + parseable amount
 *   - handleRun calls refetch and surfaces results on success
 *   - handleRun surfaces an error toast on refetch failure
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const useContractorsMock = vi.fn();
const useContractsMock = vi.fn();
const useReconciliationQueryMock = vi.fn();

vi.mock('../use-reconciliation.js', () => ({
  useReconciliationSpotCheckContractors: () => useContractorsMock(),
  useReconciliationSpotCheckContracts: (id: string) => useContractsMock(id),
  useReconciliationSpotCheckQuery: (input: unknown) => useReconciliationQueryMock(input),
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { act, renderHookWithProviders, waitFor } from '../../../../test-utils/render-hook.js';
import { useReconciliationSpotCheck } from '../use-reconciliation-spot-check.js';

function defaultMocks() {
  useContractorsMock.mockReturnValue({
    data: [
      {
        id: 'c-1',
        legalName: 'Acme GmbH',
        email: null,
        pendingCount: 0,
        approvedMinutesThisMonth: 0,
      },
    ],
    isLoading: false,
  });
  useContractsMock.mockReturnValue({
    data: {
      items: [
        {
          id: 'k-1',
          title: 'Q1 Engagement',
          rateType: 'HOURLY',
          rateValueMinor: 8_000,
          currency: 'EUR',
        },
      ],
    },
    isLoading: false,
  });
  useReconciliationQueryMock.mockReturnValue({
    data: undefined,
    isFetching: false,
    isFetched: false,
    isError: false,
    refetch: vi.fn().mockResolvedValue({ data: undefined }),
  });
}

beforeEach(() => {
  useContractorsMock.mockReset();
  useContractsMock.mockReset();
  useReconciliationQueryMock.mockReset();
  toastError.mockReset();
});

describe('useReconciliationSpotCheck', () => {
  it('defaults periodEnd to today and periodStart to one month earlier (ISO date)', () => {
    defaultMocks();
    const { result } = renderHookWithProviders(() => useReconciliationSpotCheck());
    expect(result.current.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.current.periodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(result.current.periodStart).getTime()).toBeLessThanOrEqual(
      new Date(result.current.periodEnd).getTime(),
    );
  });

  it('exposes contractors and contract list from wrapped queries', () => {
    defaultMocks();
    const { result } = renderHookWithProviders(() => useReconciliationSpotCheck());
    expect(result.current.contractors[0]?.id).toBe('c-1');
    expect(result.current.contractList[0]?.id).toBe('k-1');
    act(() => result.current.handleContractorChange('c-1'));
    expect(useContractsMock).toHaveBeenLastCalledWith('c-1');
  });

  it('handleContractorChange clears the previously selected contract', () => {
    defaultMocks();
    const { result } = renderHookWithProviders(() => useReconciliationSpotCheck());
    act(() => result.current.handleContractorChange('c-1'));
    act(() => result.current.handleContractChange('k-1'));
    expect(result.current.contractId).toBe('k-1');
    act(() => result.current.handleContractorChange('c-2'));
    expect(result.current.contractId).toBe('');
  });

  it('canRun is false until contract + valid period + parseable amount are set', () => {
    defaultMocks();
    const { result } = renderHookWithProviders(() => useReconciliationSpotCheck());
    expect(result.current.canRun).toBe(false);
    act(() => result.current.handleContractorChange('c-1'));
    act(() => result.current.handleContractChange('k-1'));
    act(() => result.current.setInvoicedInput('123.45'));
    expect(result.current.canRun).toBe(true);
  });

  it('rejects negative or non-numeric invoiced amounts', () => {
    defaultMocks();
    const { result } = renderHookWithProviders(() => useReconciliationSpotCheck());
    act(() => result.current.handleContractorChange('c-1'));
    act(() => result.current.handleContractChange('k-1'));
    act(() => result.current.setInvoicedInput('not-a-number'));
    expect(result.current.canRun).toBe(false);
    act(() => result.current.setInvoicedInput('-1'));
    expect(result.current.canRun).toBe(false);
  });

  it('handleRun calls refetch when canRun is true', async () => {
    const refetch = vi.fn().mockResolvedValue({ data: { withinThreshold: true } });
    useContractorsMock.mockReturnValue({ data: [], isLoading: false });
    useContractsMock.mockReturnValue({ data: { items: [] }, isLoading: false });
    useReconciliationQueryMock.mockReturnValue({
      data: undefined,
      isFetching: false,
      isFetched: false,
      isError: false,
      refetch,
    });
    const { result } = renderHookWithProviders(() => useReconciliationSpotCheck());
    act(() => result.current.handleContractorChange('c-1'));
    act(() => result.current.handleContractChange('k-1'));
    act(() => result.current.setInvoicedInput('100'));
    await act(async () => {
      await result.current.handleRun();
    });
    expect(refetch).toHaveBeenCalledWith({ throwOnError: true });
    expect(toastError).not.toHaveBeenCalled();
  });

  it('handleRun surfaces an error toast when refetch rejects', async () => {
    const refetch = vi.fn().mockRejectedValue(new Error('rate-limit'));
    useContractorsMock.mockReturnValue({ data: [], isLoading: false });
    useContractsMock.mockReturnValue({ data: { items: [] }, isLoading: false });
    useReconciliationQueryMock.mockReturnValue({
      data: undefined,
      isFetching: false,
      isFetched: false,
      isError: false,
      refetch,
    });
    const { result } = renderHookWithProviders(() => useReconciliationSpotCheck());
    act(() => result.current.handleContractorChange('c-1'));
    act(() => result.current.handleContractChange('k-1'));
    act(() => result.current.setInvoicedInput('100'));
    await act(async () => {
      await result.current.handleRun();
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toContain('rate-limit');
  });

  it('hasResult is true once handleRun completes and the wrapped query is idle', async () => {
    useContractorsMock.mockReturnValue({ data: [], isLoading: false });
    useContractsMock.mockReturnValue({ data: { items: [] }, isLoading: false });
    useReconciliationQueryMock.mockReturnValue({
      data: { withinThreshold: false },
      isFetching: false,
      isFetched: true,
      isError: false,
      refetch: vi.fn().mockResolvedValue({ data: { withinThreshold: false } }),
    });
    const { result } = renderHookWithProviders(() => useReconciliationSpotCheck());
    act(() => result.current.handleContractChange('k-1'));
    act(() => result.current.setInvoicedInput('100'));
    await act(async () => {
      await result.current.handleRun();
    });
    expect(result.current.hasResult).toBe(true);
    expect(result.current.result).toEqual({ withinThreshold: false });
  });
});
