/**
 * Web-vite port of apps/web/src/components/billing/__tests__/top-up-dialog.test.tsx.
 *
 * TopUpDialog is now a controlled presentational dialog — `selectedBundle`,
 * `isPending`, `onConfirm`, and the `t` translator are passed as props.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import type { TranslateFn } from '../../../i18n/useTranslations';

import { TopUpDialog } from '../top-up-dialog';

const labels: Record<string, string> = {
  title: 'Buy OCR Credits',
  description: 'Select a credit bundle. You will be redirected to Stripe.',
  selectPlaceholder: 'Select bundle size',
  priceNote: 'Exact price will be confirmed on the Stripe checkout page.',
  cancel: 'Cancel',
  confirm: 'Continue to checkout',
};

const t = ((key: string) => labels[key] ?? key) as TranslateFn;

describe('TopUpDialog (web-vite)', () => {
  it('does not render content when closed', () => {
    render(
      <TopUpDialog
        open={false}
        onOpenChange={vi.fn()}
        t={t}
        selectedBundle="10"
        onSelectedBundleChange={vi.fn()}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.queryByText('Buy OCR Credits')).not.toBeInTheDocument();
  });

  it('renders title and description when open', () => {
    render(
      <TopUpDialog
        open
        onOpenChange={vi.fn()}
        t={t}
        selectedBundle="10"
        onSelectedBundleChange={vi.fn()}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByText('Buy OCR Credits')).toBeInTheDocument();
    expect(screen.getByText(/Select a credit bundle/)).toBeInTheDocument();
  });

  it('renders Continue to checkout and Cancel buttons', () => {
    render(
      <TopUpDialog
        open
        onOpenChange={vi.fn()}
        t={t}
        selectedBundle="10"
        onSelectedBundleChange={vi.fn()}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByRole('button', { name: /continue to checkout/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(
      <TopUpDialog
        open
        onOpenChange={onOpenChange}
        t={t}
        selectedBundle="10"
        onSelectedBundleChange={vi.fn()}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('invokes onConfirm when Continue to checkout is clicked', async () => {
    const onConfirm = vi.fn();
    const { user } = setup(
      <TopUpDialog
        open
        onOpenChange={vi.fn()}
        t={t}
        selectedBundle="25"
        onSelectedBundleChange={vi.fn()}
        onConfirm={onConfirm}
        isPending={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /continue to checkout/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('disables both buttons while isPending', () => {
    render(
      <TopUpDialog
        open
        onOpenChange={vi.fn()}
        t={t}
        selectedBundle="10"
        onSelectedBundleChange={vi.fn()}
        onConfirm={vi.fn()}
        isPending
      />,
    );
    expect(screen.getByRole('button', { name: /continue to checkout/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled();
  });
});
