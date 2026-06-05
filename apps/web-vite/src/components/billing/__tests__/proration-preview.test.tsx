/**
 * ProrationPreview is a pure presentational component — translations,
 * the tRPC query, and the loading/error variant pick are owned by the
 * container. The skeleton and error states are now sibling components
 * (`ProrationPreviewSkeleton`, `ProrationPreviewError`).
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import type { TranslateFn } from '../../../i18n/useTranslations';

import {
  ProrationPreview,
  ProrationPreviewError,
  ProrationPreviewSkeleton,
} from '../proration-preview';

const labels: Record<string, string> = {
  errorLoad: 'Failed to load proration preview. Please try again.',
  title: 'Plan change preview',
  totalLabel: 'Total',
  creditNote: 'You will receive a credit of {amount} PLN for the unused portion.',
  chargeNote: 'You will be charged {amount} PLN today.',
  confirm: 'Confirm change',
  cancel: 'Cancel',
};

const t = ((key: string, vars?: Record<string, string | number>) => {
  const raw = labels[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}) as TranslateFn;

describe('ProrationPreviewSkeleton (web-vite)', () => {
  it('renders skeleton placeholders', () => {
    const { container } = render(<ProrationPreviewSkeleton />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });
});

describe('ProrationPreviewError (web-vite)', () => {
  it('shows error message and cancel button on error', async () => {
    const onCancel = vi.fn();
    const { user } = setup(<ProrationPreviewError t={t} onCancel={onCancel} />);
    expect(screen.getByText(/Failed to load proration preview/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('ProrationPreview (web-vite)', () => {
  it('renders line items and total for a charge', () => {
    render(
      <ProrationPreview
        t={t}
        lines={[{ description: 'Pro plan (remaining)', amountMinor: 15000 }]}
        totalMinor={15000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Plan change preview')).toBeInTheDocument();
    expect(screen.getByText('Pro plan (remaining)')).toBeInTheDocument();
    expect(screen.getAllByText('150.00 PLN')).toHaveLength(2);
    expect(screen.getByText(/You will be charged 150.00 PLN today/)).toBeInTheDocument();
  });

  it('renders credit message for negative total', () => {
    render(
      <ProrationPreview
        t={t}
        lines={[{ description: 'Unused portion credit', amountMinor: -5000 }]}
        totalMinor={-5000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/You will receive a credit of 50.00 PLN/)).toBeInTheDocument();
  });

  it('calls onConfirm when Confirm change is clicked', async () => {
    const onConfirm = vi.fn();
    const { user } = setup(
      <ProrationPreview
        t={t}
        lines={[{ description: 'Upgrade', amountMinor: 10000 }]}
        totalMinor={10000}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /confirm change/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    const { user } = setup(
      <ProrationPreview
        t={t}
        lines={[{ description: 'Upgrade', amountMinor: 10000 }]}
        totalMinor={10000}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables confirm button while isConfirming', () => {
    render(
      <ProrationPreview
        t={t}
        lines={[{ description: 'Upgrade', amountMinor: 10000 }]}
        totalMinor={10000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isConfirming
      />,
    );
    expect(screen.getByRole('button', { name: /confirm change/i })).toBeDisabled();
  });
});
