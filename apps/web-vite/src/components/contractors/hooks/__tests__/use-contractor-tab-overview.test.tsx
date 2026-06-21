/**
 * Hook spec for `useContractorTabOverview` — derives pii visibility from
 * the session role and exposes a tab-switch helper that mutates the URL
 * query param in `replace` mode. Mocks `usePermissions` + `useSearchParams`
 * so the test stays synchronous (<1s) and does not depend on the auth /
 * router providers.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let mockRole: string | undefined = 'owner';
let mockSearchParams = new URLSearchParams('tab=overview');
const setSearchParamsSpy = vi.fn<(next: URLSearchParams, opts?: { replace?: boolean }) => void>();

vi.mock('../../../../hooks/use-permissions.js', () => ({
  usePermissions: () => ({ role: mockRole }),
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams, setSearchParamsSpy] as const,
}));

import { useContractorTabOverview } from '../use-contractor-tab-overview.js';

afterEach(() => {
  setSearchParamsSpy.mockReset();
  mockRole = 'owner';
  mockSearchParams = new URLSearchParams('tab=overview');
});

describe('useContractorTabOverview', () => {
  it('exposes showPii=true for an owner role (success / loaded session)', () => {
    mockRole = 'owner';
    const { result } = renderHook(() => useContractorTabOverview());

    expect(result.current.showPii).toBe(true);
  });

  it('exposes showPii=false for a role without sensitive-pii grant (empty perms)', () => {
    mockRole = 'readonly';
    const { result } = renderHook(() => useContractorTabOverview());

    expect(result.current.showPii).toBe(false);
  });

  it('returns showPii=false when the session role is undefined (loading / not-signed-in)', () => {
    mockRole = undefined;
    const { result } = renderHook(() => useContractorTabOverview());

    expect(result.current.showPii).toBe(false);
  });

  it('onSwitchTab writes the new tab into URLSearchParams via replace navigation', () => {
    mockSearchParams = new URLSearchParams('tab=overview&keep=1');
    const { result } = renderHook(() => useContractorTabOverview());

    act(() => {
      result.current.onSwitchTab('compliance');
    });

    expect(setSearchParamsSpy).toHaveBeenCalledTimes(1);
    const [next, opts] = setSearchParamsSpy.mock.calls[0]!;
    expect(next.get('tab')).toBe('compliance');
    expect(next.get('keep')).toBe('1');
    expect(opts).toEqual({ replace: true });
  });
});
