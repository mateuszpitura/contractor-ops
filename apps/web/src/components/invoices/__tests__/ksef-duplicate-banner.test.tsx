import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';

import { KsefDuplicateBanner } from '../ksef-duplicate-banner';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('KsefDuplicateBanner', () => {
  it('renders duplicate messaging, NIP, and link to the KSeF invoice', () => {
    render(
      <KsefDuplicateBanner
        duplicateInvoiceId="inv-ksef-1"
        invoiceNumber="FV/2026/04"
        sellerNip="5250000000"
      />,
    );

    expect(screen.getByText('KSeF Duplicate Found')).toBeInTheDocument();
    expect(screen.getByText('FV/2026/04')).toBeInTheDocument();
    expect(screen.getByText('5250000000')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /View KSeF Invoice/i });
    expect(link).toHaveAttribute('href', '/invoices/inv-ksef-1');
  });

  it('opens the void confirmation and invokes onVoid when confirmed', async () => {
    const onVoid = vi.fn();
    const { user } = setup(
      <KsefDuplicateBanner
        duplicateInvoiceId="x"
        invoiceNumber="n"
        sellerNip="1"
        onVoid={onVoid}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Void This Invoice/i }));

    const confirmButtons = screen.getAllByRole('button', { name: /^Void Invoice$/i });
    const confirm = confirmButtons[confirmButtons.length - 1];
    await user.click(confirm);

    expect(onVoid).toHaveBeenCalledTimes(1);
  });
});
