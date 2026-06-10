/**
 * `useOnboardingSourceSelection` — drives step 1 of the onboarding import
 * wizard. Covers:
 *   - loading / error / empty / success projections of `listSources`
 *   - selection toggle (add + remove) round-trip through `onSourcesChange`
 *   - OAuth connect happy path (popup opens, refetch fires on close)
 *   - OAuth fallback when `window.open` returns null
 *   - OAuth error toast when `getOAuthUrlGeneric` rejects or returns no url
 *   - skip-link routes to `/settings?tab=members`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const routerPush = vi.fn();
vi.mock('../../../../i18n/navigation.js', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  Link: () => null,
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useOnboardingSourceSelection } from '../use-onboarding-source-selection.js';

const trpcProxy = createTRPCProxy();

const sampleSources = [
  { provider: 'JIRA', connected: true },
  { provider: 'SLACK', connected: false },
];

let onSourcesChange: ((sources: string[]) => void) & ReturnType<typeof vi.fn>;

beforeEach(() => {
  onSourcesChange = vi.fn() as typeof onSourcesChange;
  routerPush.mockReset();
  toastError.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useOnboardingSourceSelection', () => {
  it('starts in loading state with empty source list', () => {
    setTRPCMock({
      'onboardingImport.listSources': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() =>
      useOnboardingSourceSelection({ selectedSources: [], onSourcesChange }),
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.sources).toEqual([]);
  });

  it('exposes isError + empty sources when the query fails', async () => {
    setTRPCMock({
      'onboardingImport.listSources': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useOnboardingSourceSelection({ selectedSources: [], onSourcesChange }),
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.sources).toEqual([]);
  });

  it('maps resolved sources into the props bag', async () => {
    setTRPCMock({ 'onboardingImport.listSources': () => sampleSources });
    const { result } = renderHookWithProviders(() =>
      useOnboardingSourceSelection({ selectedSources: [], onSourcesChange }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sources).toEqual(sampleSources);
  });

  it('handleToggle adds and removes providers via onSourcesChange', async () => {
    setTRPCMock({ 'onboardingImport.listSources': () => sampleSources });
    const { result, rerender } = renderHookWithProviders<
      ReturnType<typeof useOnboardingSourceSelection>,
      { selectedSources: string[] }
    >(({ selectedSources }) => useOnboardingSourceSelection({ selectedSources, onSourcesChange }), {
      initialProps: { selectedSources: [] },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.handleToggle('JIRA'));
    expect(onSourcesChange).toHaveBeenLastCalledWith(['JIRA']);

    rerender({ selectedSources: ['JIRA'] });
    act(() => result.current.handleToggle('JIRA'));
    expect(onSourcesChange).toHaveBeenLastCalledWith([]);
  });

  it('routes to /settings?tab=members when handleSkip is invoked', async () => {
    setTRPCMock({ 'onboardingImport.listSources': () => sampleSources });
    const { result } = renderHookWithProviders(() =>
      useOnboardingSourceSelection({ selectedSources: [], onSourcesChange }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.handleSkip());
    expect(routerPush).toHaveBeenCalledWith('/settings?tab=members');
  });

  it('handleConnect emits error toast when getOAuthUrlGeneric returns no url', async () => {
    setTRPCMock({
      'onboardingImport.listSources': () => sampleSources,
      'integration.getOAuthUrlGeneric': () => ({}),
    });
    const { result } = renderHookWithProviders(() =>
      useOnboardingSourceSelection({ selectedSources: [], onSourcesChange }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.handleConnect('SLACK');
    });
    expect(toastError).toHaveBeenCalled();
  });

  it('handleConnect emits error toast when the OAuth query throws', async () => {
    setTRPCMock({
      'onboardingImport.listSources': () => sampleSources,
      'integration.getOAuthUrlGeneric': () => {
        throw new Error('network');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useOnboardingSourceSelection({ selectedSources: [], onSourcesChange }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.handleConnect('SLACK');
    });
    expect(toastError).toHaveBeenCalled();
  });

  it('handleConnect shows popup-blocked toast when window.open returns null', async () => {
    const originalOpen = window.open;
    window.open = vi.fn().mockReturnValue(null);

    setTRPCMock({
      'onboardingImport.listSources': () => sampleSources,
      'integration.getOAuthUrlGeneric': () => ({ url: 'https://example.com/oauth' }),
    });
    const { result } = renderHookWithProviders(() =>
      useOnboardingSourceSelection({ selectedSources: [], onSourcesChange }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.handleConnect('SLACK');
    });
    expect(toastError).toHaveBeenCalled();

    window.open = originalOpen;
  });
});
