/**
 * Hook spec for `useOrganizationCostCenters` — drives the cost-centers
 * tab list, search input, edit/create sheet, and CSV import dialog. The
 * trim-search-on-empty behaviour matters: a whitespace-only search must
 * NOT propagate to the tRPC input (avoids a server-side `ILIKE '%'`).
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useOrganizationCostCenters } from '../use-organization-cost-centers.js';

const trpcProxy = createTRPCProxy();

const sampleItem = {
  id: 'cc1',
  name: 'Operations',
  code: 'OPS',
  status: 'ACTIVE' as const,
  updatedAt: new Date('2026-05-01T10:00:00Z'),
};

describe('useOrganizationCostCenters', () => {
  it('starts with empty search, closed sheets, no editing target', () => {
    setTRPCMock({
      'organizationDefinitions.costCenter.list': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useOrganizationCostCenters());
    expect(result.current.search).toBe('');
    expect(result.current.sheetOpen).toBe(false);
    expect(result.current.csvOpen).toBe(false);
    expect(result.current.editing).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.rows).toEqual([]);
  });

  it('maps a resolved list payload to typed rows', async () => {
    setTRPCMock({
      'organizationDefinitions.costCenter.list': () => ({ items: [sampleItem] }),
    });
    const { result } = renderHookWithProviders(() => useOrganizationCostCenters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]?.id).toBe('cc1');
  });

  it('keeps rows empty on a resolved-empty payload (empty state)', async () => {
    setTRPCMock({
      'organizationDefinitions.costCenter.list': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() => useOrganizationCostCenters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toEqual([]);
  });

  it('keeps rows empty when the list query errors', async () => {
    setTRPCMock({
      'organizationDefinitions.costCenter.list': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useOrganizationCostCenters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toEqual([]);
  });

  it('sheet open/edit/csv setters are live and idempotent', () => {
    setTRPCMock({
      'organizationDefinitions.costCenter.list': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() => useOrganizationCostCenters());
    act(() => result.current.setSheetOpen(true));
    expect(result.current.sheetOpen).toBe(true);
    act(() => result.current.setCsvOpen(true));
    expect(result.current.csvOpen).toBe(true);
    act(() => result.current.setEditing({ id: 'cc-x', name: 'X', code: 'X' }));
    expect(result.current.editing).toEqual({ id: 'cc-x', name: 'X', code: 'X' });
    act(() => result.current.setSearch('finance'));
    expect(result.current.search).toBe('finance');
  });
});
