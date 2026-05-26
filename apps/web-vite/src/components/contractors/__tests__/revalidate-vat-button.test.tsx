/**
 * web-vite port. Container/component split: view takes onRevalidate + isPending.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '../../../test/test-utils.js';
import { RevalidateVatButtonView } from '../revalidate-vat-button.js';

describe('RevalidateVatButtonView', () => {
  it('renders the button with text', () => {
    render(<RevalidateVatButtonView onRevalidate={vi.fn()} isPending={false} />);
    expect(screen.getByText('Revalidate VAT')).toBeInTheDocument();
  });

  it('renders as a button element', () => {
    render(<RevalidateVatButtonView onRevalidate={vi.fn()} isPending={false} />);
    expect(screen.getByRole('button', { name: /revalidate vat/i })).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(<RevalidateVatButtonView onRevalidate={vi.fn()} isPending={false} />);
    expect(screen.getByLabelText('Revalidate VAT number')).toBeInTheDocument();
  });

  it('button is not disabled by default', () => {
    render(<RevalidateVatButtonView onRevalidate={vi.fn()} isPending={false} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('button is disabled while pending', () => {
    render(<RevalidateVatButtonView onRevalidate={vi.fn()} isPending={true} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('invokes onRevalidate when clicked', async () => {
    const onRevalidate = vi.fn();
    render(<RevalidateVatButtonView onRevalidate={onRevalidate} isPending={false} />);
    screen.getByRole('button').click();
    expect(onRevalidate).toHaveBeenCalledTimes(1);
  });
});
