/**
 * `useTopBar` — quick-action view-model. Covers:
 *   - loading: query pending → hasContractors=false
 *   - empty: total=0 → hasContractors=false
 *   - success: total>0 → hasContractors=true
 *   - navigate callbacks push to the correct routes
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const routerPush = vi.fn();

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

vi.mock('../../../../i18n/navigation.js', () => ({
  useRouter: () => ({ push: routerPush }),
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useTopBar } from '../use-top-bar.js';

const trpcProxy = createTRPCProxy();

beforeEach(() => {
  routerPush.mockReset();
  setTRPCMock({});
});

describe('useTopBar', () => {
  it('reports hasContractors=false while the count query is pending (loading)', () => {
    setTRPCMock({
      'contractor.list': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useTopBar());
    expect(result.current.hasContractors).toBe(false);
  });

  it('reports hasContractors=false when total=0 (empty)', async () => {
    setTRPCMock({
      'contractor.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useTopBar());
    await waitFor(() => expect(result.current.hasContractors).toBe(false));
  });

  it('reports hasContractors=true when total>0 (success)', async () => {
    setTRPCMock({
      'contractor.list': () => ({ items: [{ id: 'c-1' }], total: 1 }),
    });
    const { result } = renderHookWithProviders(() => useTopBar());
    await waitFor(() => expect(result.current.hasContractors).toBe(true));
  });

  it('navigateToNewContractor pushes /contractors?action=new', () => {
    setTRPCMock({ 'contractor.list': () => ({ items: [], total: 0 }) });
    const { result } = renderHookWithProviders(() => useTopBar());
    act(() => result.current.navigateToNewContractor());
    expect(routerPush).toHaveBeenCalledWith('/contractors?action=new');
  });

  it('navigateToUploadInvoice pushes /invoices?action=upload', () => {
    setTRPCMock({ 'contractor.list': () => ({ items: [], total: 0 }) });
    const { result } = renderHookWithProviders(() => useTopBar());
    act(() => result.current.navigateToUploadInvoice());
    expect(routerPush).toHaveBeenCalledWith('/invoices?action=upload');
  });
});
