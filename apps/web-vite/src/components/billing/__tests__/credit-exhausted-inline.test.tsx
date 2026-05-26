/**
 * Ported from apps/web/src/components/billing/__tests__/credit-exhausted-inline.test.tsx.
 *
 * CreditExhaustedInline is presentational — an `role="alert"` panel with
 * two CTA buttons (Upgrade plan / Buy credits) wired via props.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CreditExhaustedInline } from '../credit-exhausted-inline.js';
import { click, findButton, findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('CreditExhaustedInline (web-vite)', () => {
  it('renders the alert with the exhaustion title and description', async () => {
    const { container } = await mount(
      <CreditExhaustedInline onUpgrade={vi.fn()} onBuyCredits={vi.fn()} />,
    );
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(findByText(document.body, 'OCR credits exhausted')).not.toBeNull();
    expect(findByText(document.body, /You have used all OCR credits this month/)).not.toBeNull();
  });

  it('calls onUpgrade when the Upgrade plan button is clicked', async () => {
    const onUpgrade = vi.fn();
    await mount(<CreditExhaustedInline onUpgrade={onUpgrade} onBuyCredits={vi.fn()} />);
    const btn = findButton(document.body, /upgrade plan/i);
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('calls onBuyCredits when the Buy credits button is clicked', async () => {
    const onBuyCredits = vi.fn();
    await mount(<CreditExhaustedInline onUpgrade={vi.fn()} onBuyCredits={onBuyCredits} />);
    const btn = findButton(document.body, /buy credits/i);
    expect(btn).not.toBeNull();
    await click(btn as HTMLButtonElement);
    expect(onBuyCredits).toHaveBeenCalledTimes(1);
  });
});
