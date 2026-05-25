/**
 * `useCommandPaletteSearch` — tRPC boundary for the command palette.
 * Covers:
 *   - disabled when query <2 chars (no fetch, empty arrays)
 *   - enabled when query >=2 chars (success → results)
 *   - doc search gated by `open=true`
 *   - docResults slice to top 5
 *   - empty/missing data → empty arrays
 *   - error state — query errored, hook surfaces empty results
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', async () => {
  const { createTRPCProxy } = await import('../../../../test-utils/render-hook.js');
  const proxy = createTRPCProxy();
  return { useTRPC: () => proxy };
});

import {
  clearTRPCMock,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useCommandPaletteSearch } from '../use-command-palette-search.js';

const docs = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `d-${i}`,
    title: `Doc ${i}`,
    subtitle: 'sub',
    url: `https://example.com/${i}`,
    provider: 'notion' as const,
  }));

describe('useCommandPaletteSearch', () => {
  beforeEach(() => {
    clearTRPCMock();
  });

  it('does not search when query has fewer than 2 characters', async () => {
    setTRPCMock({
      'search.global': () => {
        throw new Error('global search should not run for short queries');
      },
      'docs.search': () => {
        throw new Error('docs search should not run for short queries');
      },
    });
    const { result } = renderHookWithProviders(() => useCommandPaletteSearch('a', true));
    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.docResults).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns entity search results when the query is long enough', async () => {
    setTRPCMock({
      'search.global': () => [
        { id: 'c1', name: 'Acme', subtitle: 'Contractor', type: 'contractor' },
      ],
      'docs.search': () => [],
    });
    const { result } = renderHookWithProviders(() => useCommandPaletteSearch('ac', true));
    expect(result.current.isSearching).toBe(true);
    await waitFor(() => {
      expect(result.current.searchResults).toHaveLength(1);
    });
    expect(result.current.searchResults[0]).toMatchObject({ id: 'c1', type: 'contractor' });
  });

  it('keeps docResults empty when the palette is closed (open=false)', async () => {
    let docsRan = false;
    setTRPCMock({
      'search.global': () => [],
      'docs.search': () => {
        docsRan = true;
        return docs(3);
      },
    });
    const { result } = renderHookWithProviders(() => useCommandPaletteSearch('ac', false));
    await waitFor(() => {
      expect(result.current.searchResults).toEqual([]);
    });
    expect(docsRan).toBe(false);
    expect(result.current.docResults).toEqual([]);
  });

  it('caps docResults to the top 5 items', async () => {
    setTRPCMock({
      'search.global': () => [],
      'docs.search': () => docs(8),
    });
    const { result } = renderHookWithProviders(() => useCommandPaletteSearch('docs', true));
    await waitFor(() => {
      expect(result.current.docResults.length).toBe(5);
    });
    expect(result.current.docResults.map(d => d.id)).toEqual(['d-0', 'd-1', 'd-2', 'd-3', 'd-4']);
  });

  it('surfaces empty results when the search returns null/undefined', async () => {
    setTRPCMock({
      'search.global': () => undefined,
      'docs.search': () => undefined,
    });
    const { result } = renderHookWithProviders(() => useCommandPaletteSearch('xx', true));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.docResults).toEqual([]);
  });

  it('keeps searchResults empty when the underlying query errors', async () => {
    setTRPCMock({
      'search.global': () => {
        throw new Error('boom');
      },
      'docs.search': () => [],
    });
    const { result } = renderHookWithProviders(() => useCommandPaletteSearch('zz', true));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.searchResults).toEqual([]);
  });
});
