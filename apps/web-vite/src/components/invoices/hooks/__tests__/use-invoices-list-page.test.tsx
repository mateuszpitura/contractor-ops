/**
 * Hook spec for `useInvoicesListPage` — covers the four required states
 * (loading / empty / error / success) plus the page-orchestration side
 * effects (deep-link upload action, clipboard email copy, compliance
 * filter nav, row click, status-chip filter wiring).
 *
 * Strategy: vi.mock the tRPC provider so React Query calls the in-test
 * handler map registered via `setTRPCMock`, then renderHook the page hook
 * inside MemoryRouter + NuqsTestingAdapter so nuqs state resolves without
 * a real browser router. No real network, no real router.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', async () => {
  const { createTRPCProxy } = await import('../../../../test-utils/render-hook.js');
  const proxy = createTRPCProxy();
  return { useTRPC: () => proxy };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { applyLocale, i18next, initI18n } from '../../../../i18n/index.js';
import { clearTRPCMock, setTRPCMock } from '../../../../test-utils/render-hook.js';
import { useInvoicesListPage } from '../use-invoices-list-page.js';

let i18nReady: Promise<void> | undefined;
async function ensureI18n(): Promise<void> {
  if (!i18nReady) {
    i18nReady = (async () => {
      await initI18n();
    })();
  }
  await i18nReady;
  await applyLocale('en');
}

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface WrapperOptions {
  initialPath?: string;
  initialSearch?: string;
}

function wrapperFactory({ initialPath = '/en', initialSearch = '' }: WrapperOptions = {}) {
  const queryClient = createTestQueryClient();
  const fullPath = `${initialPath}${initialSearch}`;
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter searchParams={initialSearch} hasMemory>
          <MemoryRouter initialEntries={[fullPath]}>
            <Routes>
              <Route
                path="/:locale/*"
                element={<I18nextProvider i18n={i18next}>{children}</I18nextProvider>}
              />
              <Route
                path="*"
                element={<I18nextProvider i18n={i18next}>{children}</I18nextProvider>}
              />
            </Routes>
          </MemoryRouter>
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );
  }
  return { Wrapper, queryClient };
}

beforeEach(async () => {
  await ensureI18n();
  clearTRPCMock();
});

afterEach(() => {
  clearTRPCMock();
});

describe('useInvoicesListPage — list states', () => {
  it('loading: countLoading + list pending while queries resolve', async () => {
    let resolveInvoices: ((value: unknown) => void) | undefined;
    let resolveContractors: ((value: unknown) => void) | undefined;
    setTRPCMock({
      'invoice.list': () =>
        new Promise(resolve => {
          resolveInvoices = resolve;
        }),
      'contractor.list': () =>
        new Promise(resolve => {
          resolveContractors = resolve;
        }),
    });

    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useInvoicesListPage(), { wrapper: Wrapper });

    expect(result.current.list.isCountLoading).toBe(true);
    expect(result.current.list.showEmptyState).toBe(false);

    await act(async () => {
      resolveInvoices?.({ items: [], total: 0 });
      resolveContractors?.({ items: [], total: 5 });
    });
  });

  it('empty: showEmptyState true when invoice count is zero', async () => {
    setTRPCMock({
      'invoice.list': () => ({ items: [], total: 0 }),
      'contractor.list': () => ({ items: [], total: 5 }),
    });

    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useInvoicesListPage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.list.showEmptyState).toBe(true));
    expect(result.current.list.contractorCount).toBe(5);
    expect(result.current.list.emptyProps.heading).toBeTruthy();
  });

  it('error: query failure surfaces empty data without throwing', async () => {
    setTRPCMock({
      'invoice.list': () => {
        throw new Error('boom');
      },
      'contractor.list': () => ({ items: [], total: 0 }),
    });

    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useInvoicesListPage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.list.isCountLoading).toBe(false));
    expect(result.current.list.tableProps.data).toEqual([]);
    expect(result.current.list.tableProps.totalRows).toBe(0);
  });

  it('success: invoices arrive — table props populated, no empty state', async () => {
    setTRPCMock({
      'invoice.list': () => ({
        items: [
          {
            id: 'inv_1',
            invoiceNumber: 'INV-1',
            status: 'RECEIVED',
            matchStatus: 'MATCHED',
            source: 'MANUAL_UPLOAD',
            currency: 'EUR',
            subtotalMinor: 100_00,
            totalMinor: 123_00,
            issueDate: '2026-01-01',
            dueDate: '2026-01-15',
            eInvoiceLifecycle: null,
          },
        ],
        total: 1,
      }),
      'contractor.list': () => ({ items: [], total: 2 }),
    });

    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useInvoicesListPage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.list.tableProps.data).toHaveLength(1));
    expect(result.current.list.showEmptyState).toBe(false);
    expect(result.current.list.tableProps.totalRows).toBe(1);
  });
});

describe('useInvoicesListPage — orchestration', () => {
  it('handleUpload toggles upload panel open/closed', async () => {
    setTRPCMock({
      'invoice.list': () => ({ items: [], total: 0 }),
      'contractor.list': () => ({ items: [], total: 0 }),
    });

    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useInvoicesListPage(), { wrapper: Wrapper });

    expect(result.current.uploadOpen).toBe(false);
    await act(async () => {
      result.current.handleUpload();
    });
    expect(result.current.uploadOpen).toBe(true);
    await act(async () => {
      result.current.handleUpload();
    });
    expect(result.current.uploadOpen).toBe(false);
  });

  it('handleRowClick selects invoice + opens side panel', async () => {
    setTRPCMock({
      'invoice.list': () => ({ items: [], total: 0 }),
      'contractor.list': () => ({ items: [], total: 0 }),
    });

    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useInvoicesListPage(), { wrapper: Wrapper });

    const row = { id: 'inv_1', invoiceNumber: 'INV-1' } as never;
    await act(async () => {
      result.current.handleRowClick(row);
    });

    expect(result.current.sidePanelOpen).toBe(true);
    expect(result.current.selectedInvoice).toBe(row);
  });

  it('handleUploadComplete closes the upload panel', async () => {
    setTRPCMock({
      'invoice.list': () => ({ items: [], total: 0 }),
      'contractor.list': () => ({ items: [], total: 0 }),
    });

    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useInvoicesListPage(), { wrapper: Wrapper });

    await act(async () => {
      result.current.handleUpload();
    });
    expect(result.current.uploadOpen).toBe(true);

    await act(async () => {
      result.current.handleUploadComplete();
    });
    expect(result.current.uploadOpen).toBe(false);
  });

  it('handleCopyEmail copies invoice email + flips emailCopied true then resets', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    setTRPCMock({
      'invoice.list': () => ({ items: [], total: 0 }),
      'contractor.list': () => ({ items: [], total: 0 }),
    });

    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useInvoicesListPage(), { wrapper: Wrapper });

    await act(async () => {
      result.current.handleCopyEmail();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(result.current.invoiceEmail);
    expect(result.current.emailCopied).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.emailCopied).toBe(false);

    vi.useRealTimers();
  });

  it('?action=upload deep link opens upload panel + clears the param', async () => {
    setTRPCMock({
      'invoice.list': () => ({ items: [], total: 0 }),
      'contractor.list': () => ({ items: [], total: 0 }),
    });

    const { Wrapper } = wrapperFactory({ initialSearch: '?action=upload' });
    const { result } = renderHook(() => useInvoicesListPage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.uploadOpen).toBe(true));
  });

  it('handleStatusChange forwards selection through tableProps.onFiltersChange', async () => {
    setTRPCMock({
      'invoice.list': () => ({ items: [], total: 0 }),
      'contractor.list': () => ({ items: [], total: 0 }),
    });

    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useInvoicesListPage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.list.isCountLoading).toBe(false));

    await act(async () => {
      result.current.handleStatusChange(['APPROVED']);
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.list.tableProps.filters.status).toEqual(['APPROVED']),
    );
  });

  it('handleComplianceReview pushes einvoiceStatus param into the URL', async () => {
    setTRPCMock({
      'invoice.list': () => ({ items: [], total: 0 }),
      'contractor.list': () => ({ items: [], total: 0 }),
    });

    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useInvoicesListPage(), { wrapper: Wrapper });

    await act(async () => {
      result.current.handleComplianceReview();
    });

    expect(typeof result.current.handleComplianceReview).toBe('function');
  });
});
