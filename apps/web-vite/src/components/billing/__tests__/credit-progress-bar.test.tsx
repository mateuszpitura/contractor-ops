/**
 * Step 10 port of apps/web/src/components/billing/__tests__/credit-progress-bar.test.tsx.
 *
 * CreditCard owns the OCR credit gauge in the billing tab and the invoice
 * submit upload flow (exhausted state -> CTA to buy credits). Tests cover:
 *   - remaining/exhausted label switch
 *   - "buy more" CTA visibility tied to `isLowCredits`
 *   - the progressbar role used by the dashboard's a11y audit
 *
 * Renders through react-dom/client (same as other web-vite tests).
 */

import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { applyLocale, initI18n } from '../../../i18n/index.js';
import { CreditCard } from '../credit-progress-bar.js';

interface Rendered {
  container: HTMLDivElement;
  unmount: () => void;
}

const mounted: Rendered[] = [];

function renderInto(node: ReactElement): Rendered {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  void act(() => {
    root.render(node);
  });
  const handle: Rendered = {
    container,
    unmount: () => {
      void act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
  mounted.push(handle);
  return handle;
}

beforeAll(async () => {
  initI18n();
  await applyLocale('en');
});

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.unmount();
  }
});

describe('CreditCard', () => {
  it('renders the used count alongside the OCR-credits label when credits remain', () => {
    const { container } = renderInto(
      <CreditCard used={30} total={100} isLowCredits={false} onBuyMore={vi.fn()} />,
    );
    expect(container.textContent).toContain('OCR Credits');
    // Big-numeral cell shows the raw `used` count.
    expect(container.textContent).toContain('30');
    // Healthy state must NOT show the exhausted copy.
    expect(container.textContent).not.toContain('No credits remaining');
  });

  it('swaps the subtitle to the exhausted copy when used >= total', () => {
    const { container } = renderInto(
      <CreditCard used={100} total={100} isLowCredits onBuyMore={vi.fn()} />,
    );
    expect(container.textContent).toContain('No credits remaining');
  });

  it('shows exhausted state even when used overshoots total (defensive)', () => {
    const { container } = renderInto(
      <CreditCard used={120} total={100} isLowCredits onBuyMore={vi.fn()} />,
    );
    expect(container.textContent).toContain('No credits remaining');
  });

  it('keeps the gauge non-exhausted on the zero-total free-tier path', () => {
    // total=0 is the free-tier sentinel: source computes
    // `isExhausted = total > 0 && remaining <= 0` → false.
    const { container } = renderInto(
      <CreditCard used={0} total={0} isLowCredits={false} onBuyMore={vi.fn()} />,
    );
    expect(container.textContent).not.toContain('No credits remaining');
  });

  it('exposes the credit gauge through role="progressbar" (a11y)', () => {
    const { container } = renderInto(
      <CreditCard used={10} total={100} isLowCredits={false} onBuyMore={vi.fn()} />,
    );
    expect(container.querySelector('[role="progressbar"]')).toBeTruthy();
  });

  it('renders the Buy more CTA only when isLowCredits is set', () => {
    const { container: low } = renderInto(
      <CreditCard used={90} total={100} isLowCredits onBuyMore={vi.fn()} />,
    );
    expect(low.textContent).toContain('Buy more');

    const { container: ok } = renderInto(
      <CreditCard used={10} total={100} isLowCredits={false} onBuyMore={vi.fn()} />,
    );
    expect(ok.textContent).not.toContain('Buy more');
  });

  it('invokes onBuyMore when the CTA is clicked', () => {
    const onBuyMore = vi.fn();
    const { container } = renderInto(
      <CreditCard used={95} total={100} isLowCredits onBuyMore={onBuyMore} />,
    );
    const buttons = Array.from(container.querySelectorAll('button')).filter(b =>
      b.textContent?.includes('Buy more'),
    );
    expect(buttons.length).toBe(1);
    void act(() => {
      buttons[0].click();
    });
    expect(onBuyMore).toHaveBeenCalledTimes(1);
  });
});
