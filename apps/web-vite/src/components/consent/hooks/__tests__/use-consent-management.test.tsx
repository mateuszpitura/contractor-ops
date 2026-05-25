/**
 * `useConsentManagement` — drives the settings consent section.
 *
 * Covers:
 *   - loading → isLoading true, showNotRequired false
 *   - empty / non-PDPL → showNotRequired true when notice null
 *   - success → notice, purposeToggles, consentHistory, crossBorder all
 *     mapped from query data; required/optional purposes flagged correctly
 *   - error → query rejection surfaces via isLoading false + empty data
 *   - grant mutation: invalidates getCurrentConsent + getConsentHistory and
 *     fires success toast
 *   - grant mutation: error path emits error toast with message
 *   - DPA / SCC downloads: success → toast + path invalidation;
 *     SCC NOT_FOUND → info toast `sccNotRequired` (not error)
 *   - download triggers an anchor click via createObjectURL
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useConsentManagement } from '../use-consent-management.js';

const trpcProxy = createTRPCProxy();

const fullNotice = {
  jurisdiction: 'AE',
  legalReference: 'UAE PDPL Article 5',
  controller: { name: 'Acme', country: 'UAE' },
  sections: [{ title: 'Collection', content: 'we collect...' }],
};

const currentConsent = {
  CONTRACTOR_DATA_PROCESSING: { granted: true },
  ANALYTICS_REPORTING: { granted: false },
};

const consentHistory = [
  {
    id: 'h1',
    purpose: 'CONTRACTOR_DATA_PROCESSING',
    granted: true,
    createdAt: '2026-01-01T00:00:00Z',
    version: 1,
  },
  {
    id: 'h2',
    purpose: 'COMMUNICATION_NOTIFICATIONS',
    granted: false,
    createdAt: '2026-02-01T00:00:00Z',
    version: 2,
  },
];

const crossBorder = { detected: true, orgRegion: 'EU', hostingRegion: 'ME' };

interface AnchorStub {
  click: ReturnType<typeof vi.fn>;
  download: string;
  href: string;
}

function stubObjectUrl(): { revoke: ReturnType<typeof vi.fn>; anchor: () => AnchorStub | null } {
  URL.createObjectURL = vi.fn(() => 'blob:test') as unknown as typeof URL.createObjectURL;
  const revoke = vi.fn();
  URL.revokeObjectURL = revoke as unknown as typeof URL.revokeObjectURL;

  let captured: AnchorStub | null = null;
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') {
      const clickSpy = vi.fn();
      Object.defineProperty(el, 'click', { value: clickSpy, configurable: true });
      captured = el as unknown as AnchorStub;
    }
    return el;
  });

  return {
    revoke,
    anchor: () => captured,
  };
}

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
  toastInfo.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useConsentManagement', () => {
  it('reports isLoading while queries are pending', () => {
    setTRPCMock({
      'consent.getPrivacyNotice': () => new Promise(() => undefined),
      'consent.getCurrentConsent': () => new Promise(() => undefined),
      'consent.getConsentHistory': () => new Promise(() => undefined),
      'consent.getCrossBorderStatus': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useConsentManagement());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.showNotRequired).toBe(false);
    expect(result.current.notice).toBeUndefined();
    expect(result.current.consentHistory).toEqual([]);
    expect(result.current.hasConsentHistory).toBe(false);
  });

  it('flags showNotRequired when notice is null (non-PDPL jurisdiction)', async () => {
    setTRPCMock({
      'consent.getPrivacyNotice': () => null,
      'consent.getCurrentConsent': () => null,
      'consent.getConsentHistory': () => [],
      'consent.getCrossBorderStatus': () => null,
    });
    const { result } = renderHookWithProviders(() => useConsentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.showNotRequired).toBe(true);
    expect(result.current.notice).toBeFalsy();
    expect(result.current.showCrossBorder).toBe(false);
  });

  it('maps queries into props bags on success', async () => {
    setTRPCMock({
      'consent.getPrivacyNotice': () => fullNotice,
      'consent.getCurrentConsent': () => currentConsent,
      'consent.getConsentHistory': () => consentHistory,
      'consent.getCrossBorderStatus': () => crossBorder,
    });
    const { result } = renderHookWithProviders(() => useConsentManagement());
    await waitFor(() => expect(result.current.notice).toEqual(fullNotice));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.showNotRequired).toBe(false);

    const contractorProcessing = result.current.purposeToggles.find(
      t => t.purpose === 'CONTRACTOR_DATA_PROCESSING',
    );
    expect(contractorProcessing).toBeDefined();
    expect(contractorProcessing?.granted).toBe(true);
    expect(contractorProcessing?.required).toBe(true);
    expect(contractorProcessing?.disabled).toBe(false);

    const analytics = result.current.purposeToggles.find(t => t.purpose === 'ANALYTICS_REPORTING');
    expect(analytics?.required).toBe(false);
    expect(analytics?.granted).toBe(false);

    expect(result.current.hasConsentHistory).toBe(true);
    expect(result.current.consentHistory[0]?.purpose).toBe('contractor data processing');
    expect(result.current.consentHistory[1]?.purpose).toBe('communication notifications');

    expect(result.current.showCrossBorder).toBe(true);
    expect(result.current.crossBorder?.detected).toBe(true);
  });

  it('isLoading becomes false on query error', async () => {
    setTRPCMock({
      'consent.getPrivacyNotice': () => {
        throw new Error('boom');
      },
      'consent.getCurrentConsent': () => {
        throw new Error('boom');
      },
      'consent.getConsentHistory': () => [],
      'consent.getCrossBorderStatus': () => null,
    });
    const { result } = renderHookWithProviders(() => useConsentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notice).toBeUndefined();
  });

  it('grant mutation success invalidates queries and emits success toast', async () => {
    const grantSpy = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'consent.getPrivacyNotice': () => fullNotice,
      'consent.getCurrentConsent': () => currentConsent,
      'consent.getConsentHistory': () => consentHistory,
      'consent.getCrossBorderStatus': () => crossBorder,
      'consent.grant': grantSpy,
    });
    const { result, queryClient } = renderHookWithProviders(() => useConsentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      result.current.onToggle('ANALYTICS_REPORTING', true);
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(grantSpy).toHaveBeenCalledWith({ purpose: 'ANALYTICS_REPORTING', granted: true });
    expect(invalidate).toHaveBeenCalled();
    const keys = invalidate.mock.calls.map(c => (c[0] as { queryKey?: unknown[] })?.queryKey?.[0]);
    expect(keys).toContain('consent.getCurrentConsent');
    expect(keys).toContain('consent.getConsentHistory');
  });

  it('grant mutation error emits error toast', async () => {
    setTRPCMock({
      'consent.getPrivacyNotice': () => fullNotice,
      'consent.getCurrentConsent': () => currentConsent,
      'consent.getConsentHistory': () => consentHistory,
      'consent.getCrossBorderStatus': () => crossBorder,
      'consent.grant': () => {
        throw new Error('rate limited');
      },
    });
    const { result } = renderHookWithProviders(() => useConsentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onToggle('ANALYTICS_REPORTING', true);
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toBe('rate limited');
  });

  it('DPA download triggers anchor click + invalidation + success toast', async () => {
    const stub = stubObjectUrl();
    setTRPCMock({
      'consent.getPrivacyNotice': () => fullNotice,
      'consent.getCurrentConsent': () => currentConsent,
      'consent.getConsentHistory': () => consentHistory,
      'consent.getCrossBorderStatus': () => crossBorder,
      'consent.downloadDPA': () => ({ content: '<html/>', filename: 'dpa.html' }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useConsentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      result.current.dpaDownload.onDownload();
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(stub.anchor()?.click).toHaveBeenCalled();
    expect(stub.anchor()?.download).toBe('dpa.html');
    expect(invalidate).toHaveBeenCalled();
  });

  it('SCC NOT_FOUND surfaces an info toast (not error)', async () => {
    const sccErr = Object.assign(new Error('missing'), {
      data: { code: 'NOT_FOUND' },
    });
    setTRPCMock({
      'consent.getPrivacyNotice': () => fullNotice,
      'consent.getCurrentConsent': () => currentConsent,
      'consent.getConsentHistory': () => consentHistory,
      'consent.getCrossBorderStatus': () => crossBorder,
      'consent.downloadSCC': () => {
        throw sccErr;
      },
    });
    const { result } = renderHookWithProviders(() => useConsentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.sccDownload.onDownload();
    });

    await waitFor(() => expect(toastInfo).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
  });

  it('SCC unexpected error emits error toast', async () => {
    setTRPCMock({
      'consent.getPrivacyNotice': () => fullNotice,
      'consent.getCurrentConsent': () => currentConsent,
      'consent.getConsentHistory': () => consentHistory,
      'consent.getCrossBorderStatus': () => crossBorder,
      'consent.downloadSCC': () => {
        throw new Error('server down');
      },
    });
    const { result } = renderHookWithProviders(() => useConsentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.sccDownload.onDownload();
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toBe('server down');
  });
});
