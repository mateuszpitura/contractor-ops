/**
 * Spec for `useEquipmentTable` — manages search/filter/page/sort state,
 * derived flags, and the equipment.list query. No mutations.
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
import { useEquipmentTable } from '../use-equipment-table.js';

const trpcProxy = createTRPCProxy();

describe('useEquipmentTable', () => {
  it('exposes initial defaults (createdAt desc, page 1)', () => {
    setTRPCMock({
      'equipment.list': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useEquipmentTable());
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(25);
    expect(result.current.sortBy).toBe('createdAt');
    expect(result.current.sortOrder).toBe('desc');
    expect(result.current.search).toBe('');
    expect(result.current.typeFilter).toEqual([]);
    expect(result.current.statusFilter).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.hasFiltersOrSearch).toBe(false);
  });

  it('maps successful list response into data + totalRows + totalPages', async () => {
    setTRPCMock({
      'equipment.list': () => ({
        items: [{ id: 'eq1', name: 'Laptop' }],
        total: 30,
      }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.totalRows).toBe(30);
    expect(result.current.totalPages).toBe(2);
  });

  it('renders empty data on resolved-empty payload', async () => {
    setTRPCMock({
      'equipment.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
    expect(result.current.totalRows).toBe(0);
    expect(result.current.totalPages).toBe(1);
  });

  it('search update resets page to 1 and bumps active filter count', async () => {
    setTRPCMock({
      'equipment.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.onPageChange(3));
    expect(result.current.page).toBe(3);
    act(() => result.current.onSearchChange('macbook'));
    expect(result.current.search).toBe('macbook');
    expect(result.current.page).toBe(1);
    expect(result.current.activeFilterCount).toBe(1);
    expect(result.current.hasFiltersOrSearch).toBe(true);
  });

  it('filter update merges partials and resets page', async () => {
    setTRPCMock({
      'equipment.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.onPageChange(2));
    act(() => result.current.onFiltersChange({ type: ['LAPTOP'] }));
    expect(result.current.typeFilter).toEqual(['LAPTOP']);
    expect(result.current.page).toBe(1);
    act(() => result.current.onFiltersChange({ status: ['AVAILABLE'] }));
    expect(result.current.statusFilter).toEqual(['AVAILABLE']);
    expect(result.current.typeFilter).toEqual(['LAPTOP']);
    expect(result.current.activeFilterCount).toBe(2);
  });

  it('sort update flips order and resets page', async () => {
    setTRPCMock({
      'equipment.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.onPageChange(4));
    act(() => result.current.onSortChange('name', 'asc'));
    expect(result.current.sortBy).toBe('name');
    expect(result.current.sortOrder).toBe('asc');
    expect(result.current.page).toBe(1);
  });

  it('clearFilters wipes search + filters and resets page', async () => {
    setTRPCMock({
      'equipment.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.onSearchChange('foo'));
    act(() => result.current.onFiltersChange({ type: ['LAPTOP'], status: ['ASSIGNED'] }));
    act(() => result.current.onClearFilters());
    expect(result.current.search).toBe('');
    expect(result.current.typeFilter).toEqual([]);
    expect(result.current.statusFilter).toEqual([]);
    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.page).toBe(1);
  });
});
