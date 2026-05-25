/**
 * Spec for `useEquipmentDetail` — getById + listReturnRequests +
 * getCourierConfigs composition. Covers loading, success, not-found,
 * generic error, and the conditional pendingReturn projection.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

vi.mock('../../../layout/breadcrumb-context.js', () => ({
  useBreadcrumbOverride: () => undefined,
}));

import {
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useEquipmentDetail } from '../use-equipment-detail.js';

const trpcProxy = createTRPCProxy();

describe('useEquipmentDetail', () => {
  it('loading state when getById is pending', () => {
    setTRPCMock({
      'equipment.getById': () => new Promise(() => undefined),
      'equipment.listReturnRequests': () => [],
      'equipment.getCourierConfigs': () => [],
    });
    const { result } = renderHookWithProviders(() => useEquipmentDetail('eq1'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.equipment).toBeUndefined();
    expect(result.current.isError).toBe(false);
  });

  it('returns equipment + configured carriers on success', async () => {
    setTRPCMock({
      'equipment.getById': () => ({
        id: 'eq1',
        name: 'Laptop',
        status: 'AVAILABLE',
        assignments: [],
        currentAssignment: null,
      }),
      'equipment.listReturnRequests': () => [],
      'equipment.getCourierConfigs': () => [{ carrier: 'inpost' }, { carrier: 'ups' }],
    });
    const { result } = renderHookWithProviders(() => useEquipmentDetail('eq1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.equipment?.id).toBe('eq1');
    expect(result.current.configuredCarriers).toEqual(['inpost', 'ups']);
    expect(result.current.pendingReturnData).toBeNull();
  });

  it('detects not-found via error message', async () => {
    setTRPCMock({
      'equipment.getById': () => {
        throw new Error('NOT_FOUND: missing');
      },
      'equipment.listReturnRequests': () => [],
      'equipment.getCourierConfigs': () => [],
    });
    const { result } = renderHookWithProviders(() => useEquipmentDetail('eq1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isNotFound).toBe(true);
  });

  it('isNotFound=false on generic error', async () => {
    setTRPCMock({
      'equipment.getById': () => {
        throw new Error('boom');
      },
      'equipment.listReturnRequests': () => [],
      'equipment.getCourierConfigs': () => [],
    });
    const { result } = renderHookWithProviders(() => useEquipmentDetail('eq1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isNotFound).toBe(false);
  });

  it('builds pendingReturnData when a matching pending return exists', async () => {
    setTRPCMock({
      'equipment.getById': () => ({
        id: 'eq1',
        name: 'Laptop',
        status: 'ASSIGNED',
        assignments: [],
        currentAssignment: {
          id: 'a1',
          contractorId: 'c1',
          contractor: { displayName: 'Acme', legalName: 'Acme Sp z o.o.' },
        },
      }),
      'equipment.listReturnRequests': () => [
        {
          id: 'rr1',
          contractorId: 'c1',
          status: 'PENDING_APPROVAL',
          targetPointName: 'KRA01',
          itemCount: 2,
          createdAt: '2026-05-01T10:00:00Z',
          contractor: { displayName: 'Acme' },
        },
      ],
      'equipment.getCourierConfigs': () => [],
    });
    const { result } = renderHookWithProviders(() => useEquipmentDetail('eq1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.pendingReturnData).not.toBeNull());
    expect(result.current.pendingReturnData).toEqual({
      id: 'rr1',
      contractorName: 'Acme',
      itemCount: 2,
      targetPointName: 'KRA01',
      createdAt: '2026-05-01T10:00:00Z',
    });
  });
});
