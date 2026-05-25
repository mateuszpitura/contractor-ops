/**
 * `useTaxDetailsForm` — step 1 of the ZATCA onboarding wizard. Covers
 * idle/pending state, success path (toast + onSuccess callback), and
 * error path (toast.error, onSuccess not fired).
 */

import type { ZatcaTaxDetails } from '@contractor-ops/einvoice/zatca/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
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
import { useTaxDetailsForm } from '../use-tax-details-form.js';

const trpcProxy = createTRPCProxy();

const sampleDetails: ZatcaTaxDetails = {
  vatNumber: '300000000000003',
  orgNameArabic: 'شركة',
  street: 'King Fahd Rd',
  city: 'Riyadh',
  district: 'Olaya',
  postalCode: '12345',
  invoiceTypes: ['standard', 'simplified'],
};

describe('useTaxDetailsForm', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    setTRPCMock({});
  });

  it('starts idle (isPending=false)', () => {
    const { result } = renderHookWithProviders(() => useTaxDetailsForm(() => undefined));
    expect(result.current.isPending).toBe(false);
  });

  it('calls onSuccess + toasts success when the save mutation resolves', async () => {
    setTRPCMock({
      'zatca.saveTaxDetails': () => ({ ok: true }),
    });
    const onSuccess = vi.fn();
    const { result } = renderHookWithProviders(() => useTaxDetailsForm(onSuccess));

    await act(async () => {
      result.current.submitTaxDetails(sampleDetails);
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalled();
  });

  it('emits an error toast and does NOT call onSuccess when the save mutation rejects', async () => {
    setTRPCMock({
      'zatca.saveTaxDetails': () => {
        throw new Error('invalid VAT');
      },
    });
    const onSuccess = vi.fn();
    const { result } = renderHookWithProviders(() => useTaxDetailsForm(onSuccess));

    await act(async () => {
      result.current.submitTaxDetails(sampleDetails);
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
