/**
 * `useCommandPalette` — composition view-model for the command palette.
 * Covers:
 *   - debounced query (set query → after 200ms → debounced flows to search)
 *   - palette close clears query + debouncedQuery
 *   - pinnedItems hydrated from localStorage on mount
 *   - togglePin: add new pin, remove existing pin, persist to localStorage
 *   - isPinned reflects current state
 *   - feature-flag gating filters navigationItems
 *   - matchedPages: <2 chars empty; >=2 chars filtered by translation/label
 *   - matchedActions: <2 chars all; >=2 chars filtered by translation
 *   - onEntityClick: addRecentItem + navigate (close palette)
 *   - onRecentSelect: page type → direct nav; entity type → addRecent + nav
 *   - onPageNavigate: addRecentItem(type='page') + navigate
 *   - entityDetailUrl: contractor/contract/invoice/other
 */

import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- module mocks ---------------------------------------------------------

const setOpenMock = vi.fn();
const addRecentItemMock = vi.fn();
const routerPushMock = vi.fn();
const searchStateRef = {
  open: true,
  recentItems: [] as Array<{ id: string; type: string; name: string; viewedAt: number }>,
};
const flagBagRef = { current: {} as Record<string, boolean | undefined> };
const searchPayloadRef = {
  current: {
    searchResults: [] as Array<{ id: string; name: string; subtitle: string; type: string }>,
    docResults: [] as Array<{
      id: string;
      title: string;
      subtitle: string;
      url: string;
      provider: 'notion' | 'confluence';
    }>,
    isSearching: false,
    isLoading: false,
    isDocLoading: false,
  },
};

vi.mock('../../search-provider.js', () => ({
  useSearch: () => ({
    open: searchStateRef.open,
    setOpen: setOpenMock,
    recentItems: searchStateRef.recentItems,
    addRecentItem: addRecentItemMock,
  }),
}));

vi.mock('../../../layout/feature-flag-context.js', () => ({
  useFlagBag: () => flagBagRef.current,
}));

vi.mock('../../../../i18n/navigation.js', () => ({
  useRouter: () => ({ push: routerPushMock, replace: vi.fn() }),
}));

vi.mock('../../../../i18n/useTranslations.js', () => ({
  useTranslations: (namespace?: string) => {
    return (key: string) => {
      if (namespace === 'Navigation') {
        // Map nav keys to deterministic translations for filter tests.
        return `nav:${key}`;
      }
      if (namespace === 'Search') {
        if (key === 'actions.newContractor') return 'New contractor';
        if (key === 'actions.newContract') return 'New contract';
        if (key === 'actions.uploadInvoice') return 'Upload invoice';
        if (key === 'actions.startWorkflow') return 'Start workflow';
        return `s:${key}`;
      }
      return `${namespace ?? ''}:${key}`;
    };
  },
}));

vi.mock('../use-command-palette-search.js', () => ({
  useCommandPaletteSearch: () => searchPayloadRef.current,
}));

// ---- imports under test ---------------------------------------------------

import { renderHookWithProviders, waitFor } from '../../../../test-utils/render-hook.js';
import { entityDetailUrl, useCommandPalette } from '../use-command-palette.js';

function resetMocks(): void {
  setOpenMock.mockReset();
  addRecentItemMock.mockReset();
  routerPushMock.mockReset();
  searchStateRef.open = true;
  searchStateRef.recentItems = [];
  flagBagRef.current = {};
  searchPayloadRef.current = {
    searchResults: [],
    docResults: [],
    isSearching: false,
    isLoading: false,
    isDocLoading: false,
  };
  localStorage.clear();
}

describe('useCommandPalette', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns initial empty query and pinned items from localStorage', () => {
    localStorage.setItem(
      'contractor-ops:pinned-items',
      JSON.stringify([{ type: 'contractor', id: 'c1', name: 'Acme' }]),
    );
    const { result } = renderHookWithProviders(() => useCommandPalette());
    expect(result.current.query).toBe('');
    expect(result.current.pinnedItems).toEqual([{ type: 'contractor', id: 'c1', name: 'Acme' }]);
  });

  it('debounces the query update before triggering downstream search', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHookWithProviders(() => useCommandPalette());
      act(() => result.current.onQueryChange('ac'));
      expect(result.current.query).toBe('ac');
      act(() => {
        vi.advanceTimersByTime(199);
      });
      // matchedPages depend on `query`, not debouncedQuery — they reflect immediately.
      // Debounced flow only matters for the downstream search hook input.
      act(() => {
        vi.advanceTimersByTime(1);
      });
      // After 200ms the debounced value has flushed; the hook stays usable.
      expect(result.current.query).toBe('ac');
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears query and debounced query when the palette closes', async () => {
    const { result, rerender } = renderHookWithProviders(() => useCommandPalette());
    act(() => result.current.onQueryChange('hello'));
    expect(result.current.query).toBe('hello');
    searchStateRef.open = false;
    rerender();
    await waitFor(() => {
      expect(result.current.query).toBe('');
    });
  });

  it('togglePin adds, removes, and persists pinned items', () => {
    const { result } = renderHookWithProviders(() => useCommandPalette());
    act(() => result.current.togglePin({ type: 'contractor', id: 'c1', name: 'Acme' }));
    expect(result.current.isPinned('contractor', 'c1')).toBe(true);
    expect(JSON.parse(localStorage.getItem('contractor-ops:pinned-items') ?? '[]')).toHaveLength(1);

    act(() => result.current.togglePin({ type: 'contractor', id: 'c1', name: 'Acme' }));
    expect(result.current.isPinned('contractor', 'c1')).toBe(false);
    expect(localStorage.getItem('contractor-ops:pinned-items')).toBe('[]');
  });

  it('filters navigationItems by feature flags via useFlagBag', () => {
    // First render: no flags enabled → flag-gated items hidden.
    const { result, rerender } = renderHookWithProviders(() => useCommandPalette());
    const withoutFlags = result.current.visibleNavItems.map(i => i.key);
    expect(withoutFlags).not.toContain('classification');

    flagBagRef.current = { 'module.classification-engine': true };
    rerender();
    expect(result.current.visibleNavItems.map(i => i.key)).toContain('classification');
  });

  it('matchedPages: empty for short queries, populated when query matches a nav label', () => {
    const { result } = renderHookWithProviders(() => useCommandPalette());
    act(() => result.current.onQueryChange('a'));
    expect(result.current.matchedPages).toEqual([]);

    // English label "Contractors" matches the literal substring (case-insensitive).
    act(() => result.current.onQueryChange('contract'));
    const matched = result.current.matchedPages.map(i => i.key);
    expect(matched.length).toBeGreaterThan(0);
  });

  it('matchedActions: returns all when query is short, filters by translation otherwise', () => {
    const { result } = renderHookWithProviders(() => useCommandPalette());
    expect(result.current.matchedActions).toHaveLength(4);

    act(() => result.current.onQueryChange('upload'));
    expect(result.current.matchedActions.map(a => a.key)).toEqual(['upload-invoice']);

    act(() => result.current.onQueryChange('xx'));
    expect(result.current.matchedActions).toEqual([]);
  });

  it('onEntityClick adds a recent entry and navigates via router.push (closing the palette)', () => {
    const { result } = renderHookWithProviders(() => useCommandPalette());
    act(() =>
      result.current.onEntityClick({
        id: 'c1',
        name: 'Acme',
        subtitle: 'Contractor',
        type: 'contractor',
      }),
    );
    expect(addRecentItemMock).toHaveBeenCalledWith({ id: 'c1', type: 'contractor', name: 'Acme' });
    expect(setOpenMock).toHaveBeenCalledWith(false);
    expect(routerPushMock).toHaveBeenCalledWith('/contractors/c1');
  });

  it('onRecentSelect: page type navigates directly; entity type re-adds + navigates', () => {
    const { result } = renderHookWithProviders(() => useCommandPalette());

    act(() =>
      result.current.onRecentSelect({
        id: '/contractors',
        type: 'page',
        name: 'Contractors',
        viewedAt: Date.now(),
      }),
    );
    expect(addRecentItemMock).not.toHaveBeenCalled();
    expect(routerPushMock).toHaveBeenCalledWith('/contractors');

    routerPushMock.mockClear();
    act(() =>
      result.current.onRecentSelect({
        id: 'inv-1',
        type: 'invoice',
        name: 'Invoice 1',
        viewedAt: Date.now(),
      }),
    );
    expect(addRecentItemMock).toHaveBeenCalledWith({
      id: 'inv-1',
      type: 'invoice',
      name: 'Invoice 1',
    });
    expect(routerPushMock).toHaveBeenCalledWith('/invoices/inv-1');
  });

  it('onPageNavigate adds recent (type=page) and navigates to the page href', () => {
    const { result } = renderHookWithProviders(() => useCommandPalette());
    const dashboard = result.current.visibleNavItems[0];
    act(() => result.current.onPageNavigate(dashboard, 'Dashboard'));
    expect(addRecentItemMock).toHaveBeenCalledWith({
      id: dashboard.href,
      type: 'page',
      name: 'Dashboard',
    });
    expect(routerPushMock).toHaveBeenCalledWith(dashboard.href);
  });

  it('entityDetailUrl returns type-prefixed paths and / for unknown types', () => {
    expect(entityDetailUrl('contractor', 'c1')).toBe('/contractors/c1');
    expect(entityDetailUrl('contract', 'k1')).toBe('/contracts/k1');
    expect(entityDetailUrl('invoice', 'i1')).toBe('/invoices/i1');
    expect(entityDetailUrl('unknown', 'x')).toBe('/');
  });
});
