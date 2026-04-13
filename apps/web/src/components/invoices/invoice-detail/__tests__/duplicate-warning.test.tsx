import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { DuplicateWarning } from '../duplicate-warning';

const {
  mutateMock,
} = vi.hoisted(() => ({
  mutateMock: vi.fn(),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    invoice: {
      dismissDuplicate: {
        mutationOptions: vi.fn((opts: { onSuccess?: () => void }) => ({
          mutationKey: ['invoice', 'dismissDuplicate'],
          mutationFn: async () => {
            mutateMock();
            opts.onSuccess?.();
          },
        })),
      },
    },
  },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useMutation: (opts: {
      mutationFn?: (vars: { id: string }) => Promise<unknown>;
      onSuccess?: () => void;
    }) => ({
      mutate: (vars: { id: string }) => {
        void Promise.resolve(opts.mutationFn?.(vars)).then(() => opts.onSuccess?.());
        mutateMock(vars);
      },
      isPending: false,
    }),
  };
});

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('DuplicateWarning', () => {
  beforeEach(() => {
    mutateMock.mockClear();
  });

  it('renders duplicate heading and invoice number in body', () => {
    render(
      <DuplicateWarning invoiceId="inv-1" duplicateInvoiceId="inv-0" invoiceNumber="FV/01/2025" />,
    );
    expect(
      screen.getByRole('heading', { name: /possible duplicate detected/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/FV\/01\/2025/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view original/i })).toHaveAttribute(
      'href',
      '/invoices/inv-0',
    );
  });

  it('calls dismiss mutation when not-a-duplicate is clicked', async () => {
    const onDismiss = vi.fn();
    const { user } = setup(
      <DuplicateWarning
        invoiceId="inv-1"
        duplicateInvoiceId={null}
        invoiceNumber="X"
        onDismiss={onDismiss}
      />,
    );
    await user.click(screen.getByRole('button', { name: /not a duplicate/i }));
    expect(mutateMock).toHaveBeenCalledWith({ id: 'inv-1' });
    expect(onDismiss).toHaveBeenCalled();
  });
});
