/**
 * `useOcrExtractionResult` — staff/portal polling of an OCR extraction.
 *
 * Covers:
 *   - loading: pending state before the query resolves
 *   - empty: extractionId === '' short-circuits enabled
 *   - error: failing queryFn surfaces isError
 *   - success: maps status/resultJson + derived isProcessing/isComplete
 *   - admin vs portal: chooses the right tRPC path
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import {
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useOcrExtractionResult } from '../use-ocr-review.js';

const trpcProxy = createTRPCProxy();

const successPayload = {
  status: 'EXTRACTED' as const,
  resultJson: {
    status: 'EXTRACTED' as const,
    fields: {
      invoiceNumber: { key: 'invoiceNumber', value: 'INV-1', confidence: 95 },
    },
    lineItems: [],
    processingTimeMs: 100,
    pageCount: 1,
    overallConfidence: 95,
  },
};

beforeEach(() => {
  setTRPCMock({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useOcrExtractionResult', () => {
  it('starts in loading state with PENDING default status', () => {
    setTRPCMock({
      'ocr.getResult': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useOcrExtractionResult('ext-1', false));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.extractionStatus).toBe('PENDING');
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.isComplete).toBe(false);
  });

  it('short-circuits both queries when extractionId is empty', () => {
    const adminHandler = vi.fn(() => successPayload);
    const portalHandler = vi.fn(() => successPayload);
    setTRPCMock({
      'ocr.getResult': adminHandler,
      'ocr.portalGetResult': portalHandler,
    });
    const { result } = renderHookWithProviders(() => useOcrExtractionResult('', false));
    expect(adminHandler).not.toHaveBeenCalled();
    expect(portalHandler).not.toHaveBeenCalled();
    expect(result.current.extraction).toBeUndefined();
    expect(result.current.extractionStatus).toBe('PENDING');
  });

  it('surfaces isError when the query rejects', async () => {
    setTRPCMock({
      'ocr.getResult': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useOcrExtractionResult('ext-err', false));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isComplete).toBe(false);
    expect(result.current.isProcessing).toBe(false);
  });

  it('exposes extracted data + derived isComplete on success', async () => {
    setTRPCMock({
      'ocr.getResult': () => successPayload,
    });
    const { result } = renderHookWithProviders(() => useOcrExtractionResult('ext-ok', false));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.extractionStatus).toBe('EXTRACTED');
    expect(result.current.isComplete).toBe(true);
    expect(result.current.isProcessing).toBe(false);
    const resultJson = result.current.resultJson as {
      fields: { invoiceNumber?: { value: string } };
    } | null;
    expect(resultJson?.fields.invoiceNumber?.value).toBe('INV-1');
  });

  it('marks isProcessing true while the extraction is still running', async () => {
    setTRPCMock({
      'ocr.getResult': () => ({
        status: 'PROCESSING' as const,
        resultJson: null,
      }),
    });
    const { result } = renderHookWithProviders(() => useOcrExtractionResult('ext-proc', false));
    await waitFor(() => expect(result.current.extractionStatus).toBe('PROCESSING'));
    expect(result.current.isProcessing).toBe(true);
    expect(result.current.isComplete).toBe(false);
  });

  it('uses the portal procedure when isPortal=true', async () => {
    const adminHandler = vi.fn(() => successPayload);
    const portalHandler = vi.fn(() => successPayload);
    setTRPCMock({
      'ocr.getResult': adminHandler,
      'ocr.portalGetResult': portalHandler,
    });
    const { result } = renderHookWithProviders(() => useOcrExtractionResult('ext-portal', true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(portalHandler).toHaveBeenCalledTimes(1);
    expect(adminHandler).not.toHaveBeenCalled();
    expect(result.current.extractionStatus).toBe('EXTRACTED');
  });
});
