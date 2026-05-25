/**
 * `useContractsListPage` — drives the contracts list page. Covers:
 *   - empty state when contract.list count = 0 (empty)
 *   - showEmptyState=false when contracts exist (success)
 *   - openWizard / openImportWizard flip the matching dialog state (interaction)
 *   - handleRowClick selects a contract + opens the side panel (interaction)
 *   - isCountLoading reflects the count query loading state (loading)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

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
import type { ContractRow } from '../../contract-table/columns.js';
import { useContractsListPage } from '../use-contracts-list-page.js';

const trpcProxy = createTRPCProxy();

const sampleRow = {
  id: 'ct-1',
  title: 'Sample',
} as unknown as ContractRow;

describe('useContractsListPage', () => {
  beforeEach(() => {
    setTRPCMock({});
  });

  it('shows the empty state when the contract count resolves to 0 (empty)', async () => {
    setTRPCMock({
      'contract.list': () => ({ items: [], total: 0 }),
      'contractor.list': () => ({ items: [], total: 0 }),
      'user.list': () => [],
    });
    const { result } = renderHookWithProviders(() => useContractsListPage());
    await waitFor(() => expect(result.current.list.showEmptyState).toBe(true));
  });

  it('does not show the empty state when contracts exist (success)', async () => {
    setTRPCMock({
      'contract.list': () => ({ items: [sampleRow], total: 1 }),
      'contractor.list': () => ({ items: [], total: 2 }),
      'user.list': () => [],
    });
    const { result } = renderHookWithProviders(() => useContractsListPage());
    await waitFor(() => expect(result.current.list.showEmptyState).toBe(false));
  });

  it('reports isCountLoading=true while the count query is pending (loading)', () => {
    setTRPCMock({
      'contract.list': () => new Promise(() => undefined),
      'contractor.list': () => new Promise(() => undefined),
      'user.list': () => [],
    });
    const { result } = renderHookWithProviders(() => useContractsListPage());
    expect(result.current.list.isCountLoading).toBe(true);
  });

  it('openWizard sets wizardOpen=true (interaction)', () => {
    setTRPCMock({
      'contract.list': () => ({ items: [], total: 0 }),
      'contractor.list': () => ({ items: [], total: 0 }),
      'user.list': () => [],
    });
    const { result } = renderHookWithProviders(() => useContractsListPage());
    expect(result.current.wizardOpen).toBe(false);
    act(() => {
      result.current.openWizard();
    });
    expect(result.current.wizardOpen).toBe(true);
  });

  it('openImportWizard sets importWizardOpen=true (interaction)', () => {
    setTRPCMock({
      'contract.list': () => ({ items: [], total: 0 }),
      'contractor.list': () => ({ items: [], total: 0 }),
      'user.list': () => [],
    });
    const { result } = renderHookWithProviders(() => useContractsListPage());
    act(() => {
      result.current.openImportWizard();
    });
    expect(result.current.importWizardOpen).toBe(true);
  });

  it('handleRowClick selects the row and opens the side panel (interaction)', () => {
    setTRPCMock({
      'contract.list': () => ({ items: [sampleRow], total: 1 }),
      'contractor.list': () => ({ items: [], total: 2 }),
      'user.list': () => [],
    });
    const { result } = renderHookWithProviders(() => useContractsListPage());
    act(() => {
      result.current.handleRowClick(sampleRow);
    });
    expect(result.current.selectedContract).toBe(sampleRow);
    expect(result.current.sidePanelOpen).toBe(true);
  });
});
