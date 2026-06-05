/**
 * Container/component split. The presentational form receives all state +
 * handlers from `useInvoiceMatchingSettings`; tRPC settings/threshold
 * queries are the hook's concern.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { useInvoiceMatchingSettings } from '../hooks/use-invoice-matching-settings';
import { InvoiceMatchingSettings } from '../invoice-matching-settings';

type HookReturn = ReturnType<typeof useInvoiceMatchingSettings>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    id: 'im',
    t: tStub,
    emailAddress: 'invoices@acme.contractorhub.io',
    threshold: 10,
    setThreshold: vi.fn(),
    isDirty: false,
    handleCopyEmail: vi.fn(),
    handleSave: vi.fn(),
    isPending: false,
    ...overrides,
  } as HookReturn;
}

describe('InvoiceMatchingSettings', () => {
  it('renders the email inbox, threshold input and copy button', () => {
    render(<InvoiceMatchingSettings {...buildHook()} />);

    const emailInput = screen.getByLabelText('invoiceEmailInbox') as HTMLInputElement;
    expect(emailInput.value).toBe('invoices@acme.contractorhub.io');
    expect(emailInput.readOnly).toBe(true);

    expect(screen.getByLabelText('deviationThreshold')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'copyEmail' })).toBeInTheDocument();
  });

  it('disables save while not dirty', () => {
    render(<InvoiceMatchingSettings {...buildHook({ isDirty: false })} />);
    expect(screen.getByRole('button', { name: 'saveCta' })).toBeDisabled();
  });

  it('enables save when dirty and shows the saving label while pending', () => {
    const { container, rerender } = render(
      <InvoiceMatchingSettings {...buildHook({ isDirty: true })} />,
    );
    expect(screen.getByRole('button', { name: 'saveCta' })).toBeEnabled();

    rerender(<InvoiceMatchingSettings {...buildHook({ isDirty: true, isPending: true })} />);
    expect(screen.getByText('saving')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('fires handleCopyEmail when the copy button is clicked', async () => {
    const handleCopyEmail = vi.fn();
    const { user } = setup(<InvoiceMatchingSettings {...buildHook({ handleCopyEmail })} />);

    await user.click(screen.getByRole('button', { name: 'copyEmail' }));
    expect(handleCopyEmail).toHaveBeenCalledTimes(1);
  });

  it('fires setThreshold as the threshold input changes', async () => {
    const setThreshold = vi.fn();
    const { user } = setup(
      <InvoiceMatchingSettings {...buildHook({ threshold: 10, setThreshold })} />,
    );

    const input = screen.getByLabelText('deviationThreshold') as HTMLInputElement;
    // The component is controlled by the `threshold` prop, so the mock
    // never advances the displayed value — we just assert that each
    // keystroke flushed through `setThreshold` at least once.
    await user.type(input, '5');
    expect(setThreshold).toHaveBeenCalled();
    expect(setThreshold.mock.calls[setThreshold.mock.calls.length - 1]?.[0]).toBe(105);
  });

  it('fires handleSave when the save button is clicked', async () => {
    const handleSave = vi.fn();
    const { user } = setup(
      <InvoiceMatchingSettings {...buildHook({ isDirty: true, handleSave })} />,
    );

    await user.click(screen.getByRole('button', { name: 'saveCta' }));
    expect(handleSave).toHaveBeenCalledTimes(1);
  });
});
