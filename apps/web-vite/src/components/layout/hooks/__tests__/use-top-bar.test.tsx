/**
 * `useTopBar` — quick-action view-model. Covers:
 *   - loading: query pending → hasContractors=false
 *   - empty: total=0 → hasContractors=false
 *   - success: total>0 → hasContractors=true
 *   - openContractorWizard / openInvoiceUpload flip local dialog state
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useTopBar } from '../use-top-bar.js';

const trpcProxy = createTRPCProxy();

// Module-level mocks rely on imports above resolving first.
import { vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

beforeEach(() => {
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

  it('openContractorWizard flips contractorWizardOpen to true', () => {
    setTRPCMock({ 'contractor.list': () => ({ items: [], total: 0 }) });
    const { result } = renderHookWithProviders(() => useTopBar());
    expect(result.current.contractorWizardOpen).toBe(false);
    act(() => result.current.openContractorWizard());
    expect(result.current.contractorWizardOpen).toBe(true);
  });

  it('openInvoiceUpload flips invoiceUploadOpen to true', () => {
    setTRPCMock({ 'contractor.list': () => ({ items: [], total: 0 }) });
    const { result } = renderHookWithProviders(() => useTopBar());
    expect(result.current.invoiceUploadOpen).toBe(false);
    act(() => result.current.openInvoiceUpload());
    expect(result.current.invoiceUploadOpen).toBe(true);
  });
});
