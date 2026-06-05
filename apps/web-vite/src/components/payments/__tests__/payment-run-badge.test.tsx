/**
 * Covers the payment run lifecycle pills (DRAFT → LOCKED → EXPORTED → COMPLETED
 * → CANCELLED) and the per-item PENDING/PAID/FAILED states — the visual
 * spine of the payment run flow (CSV export, settle).
 *
 * Rendering uses react-dom/client directly because @testing-library/react
 * is not a declared dependency of @contractor-ops/web-vite yet (Step 12).
 */

import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { PaymentItemBadge, PaymentRunBadge } from '../payment-run-badge.js';

interface Rendered {
  container: HTMLDivElement;
  unmount: () => void;
}

const mounted: Rendered[] = [];

function renderInto(node: ReactElement): Rendered {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  // React 19's `act` returns a thenable; we render synchronously (no async
  // effects in these badge components) and discard the resolved promise.
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

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.unmount();
  }
});

describe('PaymentRunBadge', () => {
  const KNOWN_STATUSES = ['DRAFT', 'LOCKED', 'EXPORTED', 'COMPLETED', 'CANCELLED'];

  it.each(KNOWN_STATUSES)('renders %s status text', status => {
    const { container } = renderInto(<PaymentRunBadge status={status} />);
    expect(container.textContent).toContain(status);
  });

  it.each(KNOWN_STATUSES)('renders an icon for %s', status => {
    const { container } = renderInto(<PaymentRunBadge status={status} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders unknown status text without crashing', () => {
    const { container } = renderInto(<PaymentRunBadge status="UNKNOWN" />);
    expect(container.textContent).toContain('UNKNOWN');
  });
});

describe('PaymentItemBadge', () => {
  const ITEM_STATUSES = ['PENDING', 'PAID', 'FAILED'];

  it.each(ITEM_STATUSES)('renders %s status text', status => {
    const { container } = renderInto(<PaymentItemBadge status={status} />);
    expect(container.textContent).toContain(status);
  });

  it('renders unknown status without crashing', () => {
    const { container } = renderInto(<PaymentItemBadge status="REFUNDED" />);
    expect(container.textContent).toContain('REFUNDED');
  });
});
