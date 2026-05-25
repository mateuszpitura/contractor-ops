/**
 * Spec for `useCarrierShipmentForm` — carrier router that dispatches to
 * inpost/dpd/ups mutations, emits a localised success toast, invalidates
 * equipment cache, and closes the dialog on success.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useCarrierShipmentForm } from '../use-carrier-shipment-form.js';

const trpcProxy = createTRPCProxy();

const dpdAddress = {
  recipientName: 'Acme',
  street: 'Long st 1',
  city: 'Kraków',
  postalCode: '30-001',
  countryCode: 'PL',
  phone: '+48500500500',
  email: 'ops@example.com',
};

const paczkomatPoint = {
  id: 'KRA01',
  name: 'KRA01N',
  address: 'Long st 1, Kraków',
};

describe('useCarrierShipmentForm', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('starts not pending', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() =>
      useCarrierShipmentForm({
        equipmentIds: ['eq1'],
        direction: 'OUTBOUND',
        onSuccess: vi.fn(),
        onOpenChange: vi.fn(),
      }),
    );
    expect(result.current.isPending).toBe(false);
  });

  it('inpost branch dispatches createInPostShipment when a point is selected', async () => {
    const inpostSpy = vi.fn(() => ({ id: 's1' }));
    setTRPCMock({
      'equipment.createInPostShipment': inpostSpy,
    });
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();
    const { result } = renderHookWithProviders(() =>
      useCarrierShipmentForm({
        equipmentIds: ['eq1'],
        direction: 'OUTBOUND',
        onSuccess,
        onOpenChange,
      }),
    );
    act(() => {
      result.current.submitShipment({
        carrier: 'inpost',
        equipmentIds: ['eq1'],
        direction: 'OUTBOUND',
        selectedPoint: paczkomatPoint,
        address: dpdAddress,
        parcelSize: 'small',
        serviceCode: '11',
      });
    });
    await waitFor(() => expect(inpostSpy).toHaveBeenCalled());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('inpost branch no-ops without a selected point', () => {
    const inpostSpy = vi.fn();
    setTRPCMock({
      'equipment.createInPostShipment': inpostSpy,
    });
    const { result } = renderHookWithProviders(() =>
      useCarrierShipmentForm({
        equipmentIds: ['eq1'],
        direction: 'OUTBOUND',
        onSuccess: vi.fn(),
        onOpenChange: vi.fn(),
      }),
    );
    act(() => {
      result.current.submitShipment({
        carrier: 'inpost',
        equipmentIds: ['eq1'],
        direction: 'OUTBOUND',
        selectedPoint: null,
        address: dpdAddress,
        parcelSize: 'small',
        serviceCode: '11',
      });
    });
    expect(inpostSpy).not.toHaveBeenCalled();
  });

  it('dpd branch dispatches createDpdShipment', async () => {
    const dpdSpy = vi.fn(() => ({ id: 's1' }));
    setTRPCMock({
      'equipment.createDpdShipment': dpdSpy,
    });
    const { result } = renderHookWithProviders(() =>
      useCarrierShipmentForm({
        equipmentIds: ['eq1'],
        direction: 'RETURN',
        onSuccess: vi.fn(),
        onOpenChange: vi.fn(),
      }),
    );
    act(() => {
      result.current.submitShipment({
        carrier: 'dpd',
        equipmentIds: ['eq1'],
        direction: 'RETURN',
        selectedPoint: null,
        address: dpdAddress,
        parcelSize: 'medium',
        serviceCode: '11',
      });
    });
    await waitFor(() => expect(dpdSpy).toHaveBeenCalled());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('ups branch dispatches createUpsShipment', async () => {
    const upsSpy = vi.fn(() => ({ id: 's1' }));
    setTRPCMock({
      'equipment.createUpsShipment': upsSpy,
    });
    const { result } = renderHookWithProviders(() =>
      useCarrierShipmentForm({
        equipmentIds: ['eq1'],
        direction: 'OUTBOUND',
        onSuccess: vi.fn(),
        onOpenChange: vi.fn(),
      }),
    );
    act(() => {
      result.current.submitShipment({
        carrier: 'ups',
        equipmentIds: ['eq1'],
        direction: 'OUTBOUND',
        selectedPoint: null,
        address: dpdAddress,
        parcelSize: 'large',
        serviceCode: '11',
      });
    });
    await waitFor(() => expect(upsSpy).toHaveBeenCalled());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('emits error toast when an underlying mutation fails', async () => {
    setTRPCMock({
      'equipment.createUpsShipment': () => {
        throw new Error('rate limit');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useCarrierShipmentForm({
        equipmentIds: ['eq1'],
        direction: 'OUTBOUND',
        onSuccess: vi.fn(),
        onOpenChange: vi.fn(),
      }),
    );
    act(() => {
      result.current.submitShipment({
        carrier: 'ups',
        equipmentIds: ['eq1'],
        direction: 'OUTBOUND',
        selectedPoint: null,
        address: dpdAddress,
        parcelSize: 'small',
        serviceCode: '11',
      });
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
