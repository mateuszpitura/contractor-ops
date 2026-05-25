/**
 * `useFlagBagValues` — owns the tRPC `featureFlags.getBag` query and
 * gates it on session readiness. Covers:
 *   - loading: session pending → returns empty flag bag, query disabled
 *   - empty: no activeOrgId → returns empty flag bag
 *   - success: query resolves → forwards bag verbatim
 *   - error: query throws → falls back to empty bag (no crash)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import { emptyFlagBag } from '@contractor-ops/feature-flags/browser';

import {
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useFlagBagValues } from '../use-flag-bag.js';

const trpcProxy = createTRPCProxy();
const empty = emptyFlagBag().values;

beforeEach(() => {
  setTRPCMock({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useFlagBagValues', () => {
  it('returns the empty flag bag while the session is pending (loading)', () => {
    const { result } = renderHookWithProviders(() => useFlagBagValues('org-1', true));
    expect(result.current).toEqual(empty);
  });

  it('returns the empty flag bag when activeOrgId is absent (empty branch)', () => {
    const { result } = renderHookWithProviders(() => useFlagBagValues(null, false));
    expect(result.current).toEqual(empty);
  });

  it('forwards the resolved bag verbatim on success', async () => {
    const bag = { ...empty, classificationEngine: true } as typeof empty;
    setTRPCMock({ 'featureFlags.getBag': () => bag });
    const { result } = renderHookWithProviders(() => useFlagBagValues('org-1', false));
    await waitFor(() => expect(result.current).toEqual(bag));
  });

  it('falls back to the empty bag when the query throws (error → empty)', async () => {
    setTRPCMock({
      'featureFlags.getBag': () => {
        throw new Error('flag service down');
      },
    });
    const { result } = renderHookWithProviders(() => useFlagBagValues('org-1', false));
    // Query rejects; hook keeps returning the empty fallback (no crash).
    await waitFor(() => expect(result.current).toEqual(empty));
  });
});
