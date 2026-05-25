/**
 * `useContractDetailPage` — composes the route param, the contract
 * fetch, and the contractParties derivation. Covers:
 *   - loading state while the contract query is pending
 *   - isError + isNotFound when the API surfaces a NOT_FOUND tRPC error
 *   - contract data + esign connections after a successful resolve (success)
 *   - empty contractParties when the contract has no contractor (empty)
 *   - contractParties is a single signer entry when contractor is set
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'ct-1' }),
  };
});

vi.mock('../../../layout/breadcrumb-context.js', () => ({
  useBreadcrumbOverride: () => undefined,
}));

import {
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useContractDetailPage } from '../use-contract-detail-page.js';

const trpcProxy = createTRPCProxy();

describe('useContractDetailPage', () => {
  beforeEach(() => {
    setTRPCMock({});
  });

  it('isLoading=true while the contract query is pending (loading)', () => {
    setTRPCMock({
      'contract.getById': () => new Promise(() => undefined),
      'esign.listConnections': () => [],
      'esign.listEnvelopes': () => [],
    });
    const { result } = renderHookWithProviders(() => useContractDetailPage());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.contract).toBeUndefined();
  });

  it('isError=true + isNotFound=true when the API surfaces a NOT_FOUND error (error/empty)', async () => {
    setTRPCMock({
      'contract.getById': () => {
        const err = new Error('Contract not found') as Error & { data?: { code?: string } };
        err.data = { code: 'NOT_FOUND' };
        throw err;
      },
      'esign.listConnections': () => [],
      'esign.listEnvelopes': () => [],
    });
    const { result } = renderHookWithProviders(() => useContractDetailPage());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isNotFound).toBe(true);
  });

  it('returns an empty contractParties list when the contract has no contractor (empty)', async () => {
    setTRPCMock({
      'contract.getById': () => ({
        id: 'ct-1',
        title: 'Orphan',
        status: 'DRAFT',
        contractor: null,
      }),
      'esign.listConnections': () => [],
      'esign.listEnvelopes': () => [],
    });
    const { result } = renderHookWithProviders(() => useContractDetailPage());
    await waitFor(() => expect(result.current.contract).toBeDefined());
    expect(result.current.contractParties).toEqual([]);
  });

  it('derives a single signer party from the contractor displayName (success)', async () => {
    setTRPCMock({
      'contract.getById': () => ({
        id: 'ct-1',
        title: 'Anchor',
        status: 'ACTIVE',
        contractor: { id: 'c-1', displayName: 'ACME', legalName: 'ACME Sp. z o.o.' },
      }),
      'esign.listConnections': () => [{ id: 'conn-1', provider: 'DOCUSIGN' }],
      'esign.listEnvelopes': () => [],
    });
    const { result } = renderHookWithProviders(() => useContractDetailPage());
    await waitFor(() => expect(result.current.contract).toBeDefined());
    expect(result.current.contractParties).toEqual([{ name: 'ACME', email: '', role: 'signer' }]);
    expect(result.current.esignConnections).toHaveLength(1);
  });

  it('surfaces the active envelope when one is in SENT status (success)', async () => {
    setTRPCMock({
      'contract.getById': () => ({
        id: 'ct-1',
        title: 'With envelope',
        status: 'PENDING_SIGNATURE',
        contractor: { id: 'c-1', displayName: 'ACME', legalName: 'ACME' },
      }),
      'esign.listConnections': () => [],
      'esign.listEnvelopes': () => [
        { id: 'env-1', status: 'SENT' },
        { id: 'env-old', status: 'COMPLETED' },
      ],
    });
    const { result } = renderHookWithProviders(() => useContractDetailPage());
    await waitFor(() => expect(result.current.activeEnvelope).toBeDefined());
    expect((result.current.activeEnvelope as unknown as { id: string }).id).toBe('env-1');
  });
});
