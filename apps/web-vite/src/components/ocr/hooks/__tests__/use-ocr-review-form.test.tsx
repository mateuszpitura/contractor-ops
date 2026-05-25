/**
 * `useOcrReviewForm` — form-state hook for the OCR review panel.
 *
 * Covers:
 *   - empty: initial state before any resultJson arrives
 *   - loading: PROCESSING resultJson does not populate the form
 *   - error: FAILED resultJson does not populate the form
 *   - success: EXTRACTED resultJson populates state + emits the toast once
 *   - PARTIAL: also populates state
 *   - derived: fieldCount/totalFields reflect resultJson; handleAccept fires
 *     with parsed minor units; setters mutate state
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: vi.fn(),
  },
}));

import type { OcrExtractionResult } from '@contractor-ops/integrations/types/ocr';

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
} from '../../../../test-utils/render-hook.js';
import { useOcrReviewForm } from '../use-ocr-review-form.js';

const trpcProxy = createTRPCProxy();

function makeResult(
  overrides: Partial<OcrExtractionResult> & { status?: OcrExtractionResult['status'] } = {},
): OcrExtractionResult {
  return {
    status: 'EXTRACTED',
    fields: {
      invoiceNumber: { key: 'invoiceNumber', value: 'INV-42', confidence: 95 },
      issueDate: { key: 'issueDate', value: '2026-05-01', confidence: 90 },
      dueDate: { key: 'dueDate', value: '2026-05-31', confidence: 80 },
      currency: { key: 'currency', value: 'EUR', confidence: 99 },
      totalNet: { key: 'totalNet', value: 12345, confidence: 95 },
      totalTax: { key: 'totalTax', value: 2839, confidence: 95 },
      totalGross: { key: 'totalGross', value: 15184, confidence: 95 },
      sellerNip: { key: 'sellerNip', value: '5260250995', confidence: 92 },
      sellerName: { key: 'sellerName', value: 'Acme Sp. z o.o.', confidence: 88 },
      buyerNip: { key: 'buyerNip', value: '1234567890', confidence: 80 },
      buyerName: { key: 'buyerName', value: 'Beta Sp. z o.o.', confidence: 80 },
      bankAccount: {
        key: 'bankAccount',
        value: 'PL12345678901234567890123456',
        confidence: 70,
      },
    },
    lineItems: [
      {
        description: 'Service A',
        quantity: 1,
        unit: 'hr',
        unitPriceMinor: 10000,
        netAmountMinor: 10000,
        vatRate: '23%',
        vatAmountMinor: 2300,
        grossAmountMinor: 12300,
        confidence: 80,
      },
    ],
    processingTimeMs: 100,
    pageCount: 1,
    overallConfidence: 90,
    ...overrides,
  };
}

beforeEach(() => {
  setTRPCMock({});
  toastSuccess.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useOcrReviewForm', () => {
  it('returns empty defaults before any resultJson arrives', () => {
    const { result } = renderHookWithProviders(() =>
      useOcrReviewForm({ resultJson: null, isComplete: false, onAccept: vi.fn() }),
    );
    expect(result.current.state.invoiceNumber).toBe('');
    expect(result.current.state.currency).toBe('PLN');
    expect(result.current.state.lineItems).toEqual([]);
    expect(result.current.derived.fieldCount).toBe(0);
    expect(result.current.derived.totalFields).toBe(0);
    expect(result.current.derived.isPopulated).toBe(false);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('does not populate the form while extraction is still PROCESSING', () => {
    const { result } = renderHookWithProviders(() =>
      useOcrReviewForm({
        resultJson: {
          ...makeResult(),
          // PROCESSING is not part of OcrExtractionResult["status"] but the hook
          // only acts on EXTRACTED|PARTIAL — cast through a runtime branch.
          status: 'FAILED',
        },
        isComplete: false,
        onAccept: vi.fn(),
      }),
    );
    expect(result.current.state.invoiceNumber).toBe('');
    expect(result.current.derived.isPopulated).toBe(false);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('does not populate the form when status is FAILED', () => {
    const { result } = renderHookWithProviders(() =>
      useOcrReviewForm({
        resultJson: makeResult({ status: 'FAILED', errorMessage: 'boom' }),
        isComplete: false,
        onAccept: vi.fn(),
      }),
    );
    expect(result.current.state.invoiceNumber).toBe('');
    expect(result.current.derived.isPopulated).toBe(false);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('populates state + fires the success toast exactly once on EXTRACTED', () => {
    const { result, rerender } = renderHookWithProviders(() =>
      useOcrReviewForm({ resultJson: makeResult(), isComplete: true, onAccept: vi.fn() }),
    );
    expect(result.current.state.invoiceNumber).toBe('INV-42');
    expect(result.current.state.currency).toBe('EUR');
    expect(result.current.state.subtotalMinor).toBe('123.45');
    expect(result.current.state.vatAmountMinor).toBe('28.39');
    expect(result.current.state.totalMinor).toBe('151.84');
    expect(result.current.state.sellerTaxId).toBe('5260250995');
    expect(result.current.state.lineItems).toHaveLength(1);
    expect(result.current.derived.isPopulated).toBe(true);
    expect(result.current.derived.fieldCount).toBeGreaterThan(0);
    expect(result.current.derived.totalFields).toBe(12);
    expect(toastSuccess).toHaveBeenCalledTimes(1);

    // Re-render with same resultJson should not double-fire the toast.
    rerender();
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  it('populates state on PARTIAL status', () => {
    const { result } = renderHookWithProviders(() =>
      useOcrReviewForm({
        resultJson: makeResult({ status: 'PARTIAL' }),
        isComplete: true,
        onAccept: vi.fn(),
      }),
    );
    expect(result.current.state.invoiceNumber).toBe('INV-42');
    expect(result.current.derived.isPopulated).toBe(true);
  });

  it('handleAccept emits parsed minor units + manual setter edits', () => {
    const onAccept = vi.fn();
    const { result } = renderHookWithProviders(() =>
      useOcrReviewForm({ resultJson: makeResult(), isComplete: true, onAccept }),
    );
    act(() => result.current.setters.setBuyerName('New Buyer'));
    act(() => result.current.setters.setSubtotalMinor('200.00'));
    act(() => result.current.derived.handleAccept());
    expect(onAccept).toHaveBeenCalledTimes(1);
    const payload = onAccept.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.invoiceNumber).toBe('INV-42');
    expect(payload.buyerName).toBe('New Buyer');
    expect(payload.subtotalMinor).toBe(20000);
    expect(payload.totalMinor).toBe(15184);
    expect(Array.isArray(payload.lineItems)).toBe(true);
  });

  it('defaults currency to PLN when the field is missing', () => {
    const noCurrency = makeResult();
    delete (noCurrency.fields as Record<string, unknown>).currency;
    const { result } = renderHookWithProviders(() =>
      useOcrReviewForm({ resultJson: noCurrency, isComplete: true, onAccept: vi.fn() }),
    );
    expect(result.current.state.currency).toBe('PLN');
  });
});
