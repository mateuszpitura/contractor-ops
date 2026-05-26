/**
 * Step-10 port. SearchProvider context — covers initial open state,
 * addRecentItem dedupe + cap, sessionStorage persistence, and
 * useSearch outside-provider error.
 */

import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RecentItem } from '../search-provider.js';
import { SearchProvider, useSearch } from '../search-provider.js';

function wrapper({ children }: { children: ReactNode }) {
  return <SearchProvider>{children}</SearchProvider>;
}

describe('SearchProvider (web-vite)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('throws when useSearch is called outside of a provider', () => {
    expect(() => renderHook(() => useSearch())).toThrow(/SearchProvider/);
  });

  it('starts with open=false and an empty recent list', () => {
    const { result } = renderHook(() => useSearch(), { wrapper });
    expect(result.current.open).toBe(false);
    expect(result.current.recentItems).toEqual([]);
  });

  it('setOpen flips the dialog state', () => {
    const { result } = renderHook(() => useSearch(), { wrapper });
    act(() => result.current.setOpen(true));
    expect(result.current.open).toBe(true);
  });

  it('addRecentItem prepends a viewedAt timestamp and persists to sessionStorage', () => {
    const { result } = renderHook(() => useSearch(), { wrapper });
    act(() => {
      result.current.addRecentItem({ id: 'c1', type: 'contractor', name: 'Acme' });
    });
    expect(result.current.recentItems).toHaveLength(1);
    expect(result.current.recentItems[0]).toMatchObject({
      id: 'c1',
      type: 'contractor',
      name: 'Acme',
    });
    expect(typeof result.current.recentItems[0].viewedAt).toBe('number');
    const persisted = JSON.parse(
      sessionStorage.getItem('contractor-ops:recent-items') ?? '[]',
    ) as RecentItem[];
    expect(persisted[0]?.id).toBe('c1');
  });

  it('dedupes recent items by (type,id), placing the latest first', () => {
    const { result } = renderHook(() => useSearch(), { wrapper });
    act(() => {
      result.current.addRecentItem({ id: 'c1', type: 'contractor', name: 'Acme' });
      result.current.addRecentItem({ id: 'c2', type: 'contractor', name: 'Beta' });
      result.current.addRecentItem({ id: 'c1', type: 'contractor', name: 'Acme' });
    });
    expect(result.current.recentItems.map(r => r.id)).toEqual(['c1', 'c2']);
  });

  it('caps the recent list at 8 entries', () => {
    const { result } = renderHook(() => useSearch(), { wrapper });
    act(() => {
      for (let i = 0; i < 12; i++) {
        result.current.addRecentItem({ id: `c${i}`, type: 'contractor', name: `n${i}` });
      }
    });
    expect(result.current.recentItems).toHaveLength(8);
  });
});
